import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import MeeshoLabelScheduleRun from '#models/meesho_label_schedule_run'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import MeeshoLabelStartJob from '#jobs/meesho_label/meesho_label_start_job'
import { MeeshoScheduleHelper } from '#services/meesho_label/meesho_schedule_helper'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'

export interface MeeshoLabelScheduleExecuteJobPayload {
  scheduleId: number
  scheduledFor: string
}

export default class MeeshoLabelScheduleExecuteJob extends Job<MeeshoLabelScheduleExecuteJobPayload> {
  async execute(): Promise<void> {
    const { scheduleId, scheduledFor } = this.payload
    const scheduledForDt = DateTime.fromISO(scheduledFor)

    // Check idempotency in schedule runs
    const existingRun = await MeeshoLabelScheduleRun.query()
      .where('schedule_id', scheduleId)
      .where('scheduled_for', scheduledForDt.toSQL()!)
      .first()

    if (existingRun && ['RUNNING', 'COMPLETED'].includes(existingRun.status)) {
      logger.info(
        { scheduleId, scheduledFor, status: existingRun.status },
        'MeeshoLabelScheduleExecuteJob: run already initiated or completed, skipping'
      )
      return
    }

    const run =
      existingRun ||
      (await MeeshoLabelScheduleRun.create({
        scheduleId,
        scheduledFor: scheduledForDt,
        status: 'RUNNING',
        startedAt: DateTime.now(),
      }))

    run.status = 'RUNNING'
    run.startedAt = DateTime.now()
    await run.save()

    const schedule = await MeeshoLabelSchedule.query()
      .where('id', scheduleId)
      .preload('accounts')
      .first()

    if (!schedule) {
      logger.error({ scheduleId }, 'MeeshoLabelScheduleExecuteJob: schedule not found')
      run.status = 'FAILED'
      await run.save()
      return
    }

    if (!schedule.enabled) {
      logger.info({ scheduleId }, 'MeeshoLabelScheduleExecuteJob: schedule disabled, skipping run')
      run.status = 'COMPLETED'
      run.completedAt = DateTime.now()
      await run.save()
      return
    }

    const validAccounts = schedule.accounts || []
    if (validAccounts.length === 0) {
      logger.warn({ scheduleId }, 'MeeshoLabelScheduleExecuteJob: no accounts attached to schedule')
      run.status = 'FAILED'
      run.completedAt = DateTime.now()
      await run.save()
      return
    }

    // Create the label job in SQL
    const jobId = randomUUID()
    const labelJob = await MeeshoLabelJob.create({
      id: jobId,
      userId: schedule.userId,
      type: 'scheduled',
      status: 'QUEUED',
      totalAccounts: validAccounts.length,
      completedAccounts: 0,
      failedAccounts: 0,
      startedAt: DateTime.now(),
    })

    run.jobId = labelJob.id
    run.status = 'COMPLETED'
    run.completedAt = DateTime.now()
    await run.save()

    logger.info(
      { scheduleId, jobId, accountsCount: validAccounts.length },
      'Scheduled label job created, enqueuing account start jobs'
    )

    await MeeshoLabelEventBroadcaster.broadcast(schedule.userId, jobId, 'job_created', {
      totalLabels: 0,
      status: 'QUEUED',
    })

    // Create account-level records and dispatch START jobs concurrently
    for (const account of validAccounts) {
      const jobAccount = await MeeshoLabelJobAccount.create({
        jobId,
        accountId: account.id,
        status: 'PENDING',
      })

      await MeeshoLabelStartJob.dispatch({
        jobId,
        jobAccountId: jobAccount.id,
        accountId: account.id,
        userId: schedule.userId,
        filter: schedule.filter || undefined,
      })
    }

    // Calculate and enqueue next schedule occurrence
    try {
      const nextRun = MeeshoScheduleHelper.calculateNextRun(
        schedule.timezone,
        schedule.runTime,
        DateTime.now()
      )

      schedule.lastRunAt = DateTime.now()
      schedule.nextRunAt = nextRun
      await schedule.save()

      const delayMs = MeeshoScheduleHelper.calculateDelayMs(nextRun)
      logger.info(
        { scheduleId, nextRunAt: nextRun.toISO(), delayMs },
        'Next schedule execution calculated and scheduled'
      )

      await MeeshoLabelScheduleExecuteJob.dispatch({
        scheduleId,
        scheduledFor: nextRun.toISO()!,
      }).in(delayMs)
    } catch (err: any) {
      logger.error(
        { scheduleId, error: err.message },
        'Failed to schedule next recurrence for MeeshoLabelSchedule'
      )
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error(
      { error: error.message, payload: this.payload },
      'MeeshoLabelScheduleExecuteJob uncaught failure'
    )
  }
}
