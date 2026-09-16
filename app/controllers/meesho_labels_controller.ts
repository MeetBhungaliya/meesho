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

    const query = MeeshoLabelJob.query().where('user_id', user.id).orderBy('created_at', 'desc')

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
   * GET /meesho/labels/jobs/:id/download
   * Generates a short-lived signed URL for downloading the final merged PDF.
   */
  async downloadFinalPdf({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const job = await MeeshoLabelJob.query()
      .where('id', params.id)
      .where('user_id', user.id)
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

    const signedUrl = await MeeshoLabelStorageService.getSignedDownloadUrl(job.finalPdfS3Key, 300)

    return response.ok({
      downloadUrl: signedUrl,
      filename: `meesho-labels-${job.id}.pdf`,
      size: job.finalPdfSize,
      expiresIn: 300,
    })
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
      payload.frequency,
      payload.runTime,
      payload.daysOfWeek || null,
      DateTime.now()
    )

    const schedule = await MeeshoLabelSchedule.create({
      userId: user.id,
      name: payload.name,
      timezone,
      frequency: payload.frequency,
      runTime: payload.runTime,
      daysOfWeek: payload.daysOfWeek || null,
      cronExpression: payload.cronExpression || null,
      enabled: true,
      nextRunAt,
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

    return response.ok({
      message: 'Schedules retrieved successfully',
      data: schedules,
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

    return response.ok({
      message: 'Schedule retrieved successfully',
      data: schedule,
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
    if (payload.frequency !== undefined) schedule.frequency = payload.frequency
    if (payload.runTime !== undefined) schedule.runTime = payload.runTime
    if (payload.daysOfWeek !== undefined) schedule.daysOfWeek = payload.daysOfWeek || null
    if (payload.cronExpression !== undefined)
      schedule.cronExpression = payload.cronExpression || null
    if (payload.enabled !== undefined) schedule.enabled = payload.enabled

    // Recompute next run if frequency or runTime or timezone changed
    const nextRunAt = MeeshoScheduleHelper.calculateNextRun(
      schedule.timezone,
      schedule.frequency,
      schedule.runTime,
      schedule.daysOfWeek,
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
        schedule.frequency,
        schedule.runTime,
        schedule.daysOfWeek,
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

    return response.ok({
      message: 'Schedule deleted successfully',
    })
  }
}
