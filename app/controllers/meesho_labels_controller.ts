import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import Account from '#models/account'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import MeeshoLabelStartJob from '#jobs/meesho_label/meesho_label_start_job'
import MeeshoLabelScheduleExecuteJob from '#jobs/meesho_label/meesho_label_schedule_execute_job'
import { MeeshoScheduleHelper } from '#services/meesho_label/meesho_schedule_helper'
import { MeeshoLabelStorageService } from '#services/meesho_label/meesho_label_storage_service'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import { SessionManager } from '#services/external_api/session_manager'
import transmit from '@adonisjs/transmit/services/main'
import {
  createManualDownloadValidator,
  createScheduleValidator,
  updateScheduleValidator,
} from '#validators/meesho_label'

export default class MeeshoLabelsController {
  /**
   * POST /meesho/labels/download
   * Triggers a manual label download job for the selected accounts.
   */
  async download({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(createManualDownloadValidator)

    const normalizedAccountIds = payload.accountIds.map((id) => Number(id))

    // Normalise filter: convert { labelDownloaded: 'Yes' | 'No' } from the frontend
    // into the Meesho API wire format { label_downloaded: { status: true | false } }
    let meeshoFilter: Record<string, unknown> | undefined
    if (payload.filter && typeof payload.filter === 'object') {
      const rawFilter = payload.filter as Record<string, unknown>
      if (rawFilter.labelDownloaded !== undefined) {
        const isDownloaded =
          rawFilter.labelDownloaded === true || rawFilter.labelDownloaded === 'Yes'
        meeshoFilter = { label_downloaded: { status: isDownloaded } }
      } else {
        // Pass through any other filter keys as-is
        meeshoFilter = rawFilter
      }
    }

    // Ensure all requested accounts belong to the authenticated user
    const userAccounts = await Account.query()
      .where('user_id', user.id)
      .whereIn('id', normalizedAccountIds)

    if (userAccounts.length === 0) {
      return response.badRequest({
        message: 'None of the provided account IDs are valid for your account',
      })
    }

    if (userAccounts.length !== normalizedAccountIds.length) {
      const foundIds = new Set(userAccounts.map((a) => a.id))
      const missingIds = normalizedAccountIds.filter((id) => !foundIds.has(id))
      return response.forbidden({
        message: `You do not have permission for account ID(s): ${missingIds.join(', ')}`,
      })
    }

    const jobId = randomUUID()

    await MeeshoLabelJob.create({
      id: jobId,
      userId: user.id,
      type: 'manual',
      status: 'QUEUED',
      totalAccounts: userAccounts.length,
      completedAccounts: 0,
      failedAccounts: 0,
      totalLabels: 0,
      processedLabels: 0,
      failedLabels: 0,
      startedAt: DateTime.now(),
    })

    await MeeshoLabelEventBroadcaster.broadcast(user.id, jobId, 'job_created', {
      totalLabels: 0,
      status: 'QUEUED',
    })

    // Create account-level records and dispatch START jobs concurrently
    for (const account of userAccounts) {
      const jobAccount = await MeeshoLabelJobAccount.create({
        jobId,
        accountId: account.id,
        status: 'PENDING',
      })

      await MeeshoLabelStartJob.dispatch({
        jobId,
        jobAccountId: jobAccount.id,
        accountId: account.id,
        userId: user.id,
        filter: meeshoFilter,
      })
    }

    return response.created({
      message: 'Meesho label download job queued successfully',
      jobId,
      status: 'QUEUED',
      totalAccounts: userAccounts.length,
    })
  }

  /**
   * GET /meesho/labels/jobs
   * Lists label download jobs for the authenticated user (paginated).
   */
  async indexJobs({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const status = request.input('status')

    const query = MeeshoLabelJob.query()
      .where('user_id', user.id)
      .preload('accounts', (accQuery) => {
        accQuery.preload('account')
      })
      .orderBy('created_at', 'desc')

    if (status) {
      query.where('status', status)
    }

    const jobs = await query.paginate(page, limit)

    return response.ok({
      message: 'Label jobs retrieved successfully',
      data: jobs.all(),
      meta: jobs.getMeta(),
    })
  }

  /**
   * GET /meesho/labels/jobs/:id
   * Returns details for a specific label download job.
   */
  async showJob({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const job = await MeeshoLabelJob.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .preload('accounts', (accQuery) => {
        accQuery.preload('account')
      })
      .first()

    if (!job) {
      return response.notFound({ message: 'Label job not found' })
    }

    return response.ok({
      message: 'Label job retrieved successfully',
      data: job,
    })
  }

  /**
   * GET /meesho/labels/jobs/:id/progress
   * Fast real-time progress endpoint for polling clients.
   */
  async jobProgress({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const job = await MeeshoLabelJob.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!job) {
      return response.notFound({ message: 'Label job not found' })
    }

    const accounts = await MeeshoLabelJobAccount.query()
      .where('job_id', job.id)
      .select(
        'id',
        'account_id',
        'supplier_name',
        'status',
        'meesho_request_id',
        'total_suborders',
        'successful_suborders',
        'progress_percent',
        'error_code',
        'error_message'
      )

    return response.ok({
      jobId: job.id,
      status: job.status,
      totalAccounts: job.totalAccounts,
      completedAccounts: job.completedAccounts,
      failedAccounts: job.failedAccounts,
      totalLabels: job.totalLabels,
      processedLabels: job.processedLabels,
      failedLabels: job.failedLabels,
      finalPdfReady: Boolean(job.finalPdfS3Key),
      accounts,
    })
  }

  /**
   * Helper to format descriptive filename with account names and date/time in IST.
   * Only includes non-failed accounts in the filename.
   */
  private generatePdfFilename(job: MeeshoLabelJob): string {
    const nameSet = new Set<string>()

    if (job.accounts && job.accounts.length > 0) {
      for (const ja of job.accounts) {
        // Skip failed accounts — their labels are not in the PDF
        if (ja.status === 'FAILED') continue

        // Use supplierName as the canonical name (set during the start job).
        // Fall back to the related account's email-derived name only if supplierName is missing.
        const name = ja.supplierName || ja.account?.email
        if (name) {
          nameSet.add(name)
        }
      }
    }

    const accountNames = Array.from(nameSet)

    let accountStr = 'Meesho'
    if (accountNames.length > 0) {
      accountStr = accountNames.map((n) => n.replace(/[^a-zA-Z0-9_-]+/g, '_')).join('_&_')
    }

    const dt = (job.createdAt || DateTime.now()).setZone('Asia/Kolkata')
    const monthStr = dt.toFormat('LLLL') // e.g. January
    const dateStr = dt.toFormat('dd-MM-yyyy')

    return `${accountStr}_Labels_${monthStr}_${dateStr}.pdf`
  }

  /**
   * GET /meesho/labels/jobs/:id/download
   * Generates a short-lived signed URL for downloading the final merged PDF.
   */
  async downloadFinalPdf({ request, auth, params, response }: HttpContext) {
    const user = auth.user!
    const job = await MeeshoLabelJob.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .preload('accounts', (accQuery) => {
        accQuery.preload('account')
      })
      .first()

    if (!job) {
      return response.notFound({ message: 'Label job not found' })
    }

    if (!job.finalPdfS3Key || !['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)) {
      return response.badRequest({
        message: 'Final PDF is not yet ready or job has not completed',
        status: job.status,
      })
    }

    const filename = this.generatePdfFilename(job)
    const signedUrl = await MeeshoLabelStorageService.getSignedDownloadUrl(
      job.finalPdfS3Key,
      300,
      filename
    )

    const expectsJson =
      request.header('accept')?.includes('json') || request.accepts(['json']) === 'json'

    if (expectsJson) {
      return response.ok({
        downloadUrl: signedUrl,
        filename,
        size: job.finalPdfSize,
        expiresIn: 300,
      })
    }

    return response.redirect(signedUrl)
  }

  /**
   * POST /meesho/labels/schedules
   * Creates an automated label download schedule.
   */
  async createSchedule({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(createScheduleValidator)

    const normalizedAccountIds = payload.accountIds.map((id) => Number(id))

    const userAccounts = await Account.query()
      .where('user_id', user.id)
      .whereIn('id', normalizedAccountIds)

    if (userAccounts.length !== normalizedAccountIds.length) {
      return response.forbidden({
        message: 'One or more selected accounts are invalid or do not belong to you',
      })
    }

    const timezone = payload.timezone || 'Asia/Kolkata'
    const nextRunAt = MeeshoScheduleHelper.calculateNextRun(
      timezone,
      payload.runTime,
      DateTime.now()
    )

    const schedule = await MeeshoLabelSchedule.create({
      userId: user.id,
      name: payload.name,
      timezone,
      frequency: 'daily',
      runTime: payload.runTime,
      daysOfWeek: null,
      cronExpression: null,
      enabled: true,
      nextRunAt,
      filter: payload.filter || null,
    })

    // Attach selected accounts
    await schedule.related('accounts').attach(userAccounts.map((a) => a.id))

    // Calculate delay and enqueue delayed schedule execution
    const delayMs = MeeshoScheduleHelper.calculateDelayMs(nextRunAt)
    await MeeshoLabelScheduleExecuteJob.dispatch({
      scheduleId: schedule.id,
      scheduledFor: nextRunAt.toISO()!,
    }).in(delayMs)

    await schedule.load('accounts')

    transmit.broadcast(`meesho-labels/${user.id}`, {
      type: 'schedules_updated',
      timestamp: new Date().toISOString(),
    })

    return response.created({
      message: 'Label schedule created successfully',
      data: schedule,
    })
  }

  /**
   * GET /meesho/labels/schedules
   * Lists all schedules for the user.
   */
  async listSchedules({ auth, response }: HttpContext) {
    const user = auth.user!
    const schedules = await MeeshoLabelSchedule.query()
      .where('user_id', user.id)
      .preload('accounts')
      .preload('runs', (runQuery) => {
        runQuery.orderBy('created_at', 'desc').limit(5)
      })
      .orderBy('created_at', 'desc')

    const schedulesJson = schedules.map((s) => s.serialize())
    for (const schedule of schedulesJson) {
      if (schedule.accounts) {
        for (const account of schedule.accounts) {
          const supplierData = await SessionManager.getSupplierData(account.id.toString())
          account.supplierData = supplierData
        }
      }
    }

    return response.ok({
      message: 'Schedules retrieved successfully',
      data: schedulesJson,
    })
  }

  /**
   * GET /meesho/labels/schedules/:id
   * Retrieves a specific schedule with accounts and recent runs.
   */
  async showSchedule({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const schedule = await MeeshoLabelSchedule.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .preload('accounts')
      .preload('runs', (runQuery) => {
        runQuery.orderBy('created_at', 'desc').limit(10)
      })
      .first()

    if (!schedule) {
      return response.notFound({ message: 'Schedule not found' })
    }

    const scheduleJson = schedule.serialize()
    if (scheduleJson.accounts) {
      for (const account of scheduleJson.accounts) {
        const supplierData = await SessionManager.getSupplierData(account.id.toString())
        account.supplierData = supplierData
      }
    }

    return response.ok({
      message: 'Schedule retrieved successfully',
      data: scheduleJson,
    })
  }

  /**
   * PUT /meesho/labels/schedules/:id
   * Updates an existing schedule.
   */
  async updateSchedule({ auth, params, request, response }: HttpContext) {
    const user = auth.user!
    const schedule = await MeeshoLabelSchedule.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!schedule) {
      return response.notFound({ message: 'Schedule not found' })
    }

    const payload = await request.validateUsing(updateScheduleValidator)

    if (payload.name !== undefined) schedule.name = payload.name
    if (payload.timezone !== undefined) schedule.timezone = payload.timezone
    if (payload.runTime !== undefined) schedule.runTime = payload.runTime
    if (payload.enabled !== undefined) schedule.enabled = payload.enabled
    if (payload.filter !== undefined) schedule.filter = payload.filter || null

    schedule.frequency = 'daily'
    schedule.daysOfWeek = null
    schedule.cronExpression = null

    // Recompute next run if runTime or timezone changed
    const nextRunAt = MeeshoScheduleHelper.calculateNextRun(
      schedule.timezone,
      schedule.runTime,
      DateTime.now()
    )
    schedule.nextRunAt = nextRunAt

    await schedule.save()

    if (payload.accountIds !== undefined) {
      const normalizedAccountIds = payload.accountIds.map((id) => Number(id))
      const userAccounts = await Account.query()
        .where('user_id', user.id)
        .whereIn('id', normalizedAccountIds)

      await schedule.related('accounts').sync(userAccounts.map((a) => a.id))
    }

    if (schedule.enabled) {
      const delayMs = MeeshoScheduleHelper.calculateDelayMs(nextRunAt)
      await MeeshoLabelScheduleExecuteJob.dispatch({
        scheduleId: schedule.id,
        scheduledFor: nextRunAt.toISO()!,
      }).in(delayMs)
    }

    await schedule.load('accounts')

    transmit.broadcast(`meesho-labels/${user.id}`, {
      type: 'schedules_updated',
      timestamp: new Date().toISOString(),
    })

    return response.ok({
      message: 'Schedule updated successfully',
      data: schedule,
    })
  }

  /**
   * PATCH /meesho/labels/schedules/:id/toggle
   * Enables or disables a schedule.
   */
  async toggleSchedule({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const schedule = await MeeshoLabelSchedule.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!schedule) {
      return response.notFound({ message: 'Schedule not found' })
    }

    schedule.enabled = !schedule.enabled

    if (schedule.enabled) {
      const nextRunAt = MeeshoScheduleHelper.calculateNextRun(
        schedule.timezone,
        schedule.runTime,
        DateTime.now()
      )
      schedule.nextRunAt = nextRunAt
      const delayMs = MeeshoScheduleHelper.calculateDelayMs(nextRunAt)
      await MeeshoLabelScheduleExecuteJob.dispatch({
        scheduleId: schedule.id,
        scheduledFor: nextRunAt.toISO()!,
      }).in(delayMs)
    }

    await schedule.save()

    transmit.broadcast(`meesho-labels/${user.id}`, {
      type: 'schedules_updated',
      timestamp: new Date().toISOString(),
    })

    return response.ok({
      message: `Schedule ${schedule.enabled ? 'enabled' : 'disabled'} successfully`,
      data: schedule,
    })
  }

  /**
   * DELETE /meesho/labels/schedules/:id
   * Deletes a schedule.
   */
  async destroySchedule({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const schedule = await MeeshoLabelSchedule.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!schedule) {
      return response.notFound({ message: 'Schedule not found' })
    }

    await schedule.delete()

    transmit.broadcast(`meesho-labels/${user.id}`, {
      type: 'schedules_updated',
      timestamp: new Date().toISOString(),
    })

    return response.ok({
      message: 'Schedule deleted successfully',
    })
  }
}
