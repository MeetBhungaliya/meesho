import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import MeeshoLabelScheduleRun from '#models/meesho_label_schedule_run'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import MeeshoLabelScheduleExecuteJob from '#jobs/meesho_label/meesho_label_schedule_execute_job'
import MeeshoLabelPollJob from '#jobs/meesho_label/meesho_label_poll_job'
import MeeshoLabelFinalizeJob from '#jobs/meesho_label/meesho_label_finalize_job'
import { MeeshoScheduleHelper } from '#services/meesho_label/meesho_schedule_helper'

export default class MeeshoLabelScheduleReconcileJob extends Job {
  async execute(): Promise<void> {
    logger.info('Running MeeshoLabelScheduleReconcileJob reconciliation sweep')

    await this.reconcileSchedules()
    await this.recoverStaleAccounts()
    await this.recoverUnfinalizedJobs()
  }

  /**
   * Recovers schedules that missed their trigger due to server/worker restarts.
   */
  private async reconcileSchedules(): Promise<void> {
    const now = DateTime.now()

    // 1. Schedules where next_run_at has passed
    const overdueSchedules = await MeeshoLabelSchedule.query()
      .where('enabled', true)
      .whereNotNull('next_run_at')
      .where('next_run_at', '<=', now.toSQL()!)

    for (const schedule of overdueSchedules) {
      if (!schedule.nextRunAt) continue

      const existingRun = await MeeshoLabelScheduleRun.query()
        .where('schedule_id', schedule.id)
        .where('scheduled_for', schedule.nextRunAt.toSQL()!)
        .first()

      if (!existingRun) {
        logger.info(
          { scheduleId: schedule.id, scheduledFor: schedule.nextRunAt.toISO() },
          'Reconciliation: Triggering missed schedule run'
        )

        await MeeshoLabelScheduleExecuteJob.dispatch({
          scheduleId: schedule.id,
          scheduledFor: schedule.nextRunAt.toISO()!,
        })
      }
    }

    // 2. Enabled schedules with missing next_run_at
    const unscheduled = await MeeshoLabelSchedule.query()
      .where('enabled', true)
      .whereNull('next_run_at')

    for (const schedule of unscheduled) {
      const nextRun = MeeshoScheduleHelper.calculateNextRun(
        schedule.timezone,
        schedule.frequency,
        schedule.runTime,
        schedule.daysOfWeek,
        now
      )

      schedule.nextRunAt = nextRun
      await schedule.save()

      const delayMs = MeeshoScheduleHelper.calculateDelayMs(nextRun)
      await MeeshoLabelScheduleExecuteJob.dispatch({
        scheduleId: schedule.id,
        scheduledFor: nextRun.toISO()!,
      }).in(delayMs)
    }
  }

  /**
   * Recovers account requests stuck in POLLING / REQUESTING due to worker restarts.
   */
  private async recoverStaleAccounts(): Promise<void> {
    const staleThreshold = DateTime.now().minus({ minutes: 15 })

    // Find accounts stuck in POLLING with no recent updates
    const stalePolling = await MeeshoLabelJobAccount.query()
      .where('status', 'POLLING')
      .whereNotNull('meesho_request_id')
      .where('updated_at', '<=', staleThreshold.toSQL()!)

    for (const account of stalePolling) {
      const parentJob = await MeeshoLabelJob.find(account.jobId)
      if (!parentJob) continue

      logger.info(
        { jobAccountId: account.id, jobId: account.jobId, requestId: account.meeshoRequestId },
        'Reconciliation: Re-enqueueing stalled polling job'
      )

      await MeeshoLabelPollJob.dispatch({
        jobId: account.jobId,
        jobAccountId: account.id,
        accountId: account.accountId,
        userId: parentJob.userId,
        attempt: (account.attemptCount || 0) + 1,
      })
    }
  }

  /**
   * Recovers jobs where all accounts have finished but finalization was not triggered.
   */
  private async recoverUnfinalizedJobs(): Promise<void> {
    const staleThreshold = DateTime.now().minus({ minutes: 10 })

    const unfinalizedJobs = await MeeshoLabelJob.query()
      .whereIn('status', ['QUEUED', 'PROCESSING'])
      .whereNull('final_pdf_s3_key')
      .where('updated_at', '<=', staleThreshold.toSQL()!)

    for (const job of unfinalizedJobs) {
      const accounts = await MeeshoLabelJobAccount.query().where('job_id', job.id)
      if (accounts.length === 0) continue

      const allTerminal = accounts.every((acc) => ['PROCESSED', 'FAILED'].includes(acc.status))
      if (allTerminal) {
        logger.info({ jobId: job.id }, 'Reconciliation: Triggering finalization for stranded job')

        await MeeshoLabelFinalizeJob.dispatch({
          jobId: job.id,
          userId: job.userId,
        })
      }
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'MeeshoLabelScheduleReconcileJob failed')
  }
}
