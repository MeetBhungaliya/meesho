import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import Account from '#models/account'
import { isSyncRunning } from '#services/meesho_ads_sync_service'
import SyncMeeshoAdsAccountJob from '#jobs/sync_meesho_ads_account'
import logger from '@adonisjs/core/services/logger'

/**
 * Scheduler-invoked job that fans out per-account sync jobs.
 * No payload required — discovers all active accounts at runtime.
 *
 * Registered in start/scheduler.ts to run every 30 minutes.
 */
export default class ScheduleMeeshoAdsSyncJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0,
  }

  async execute(): Promise<void> {
    logger.info('[ScheduleMeeshoAdsSyncJob] Running scheduled Meesho Ads sync')

    try {
      const accounts = await Account.query().where('session_status', 'active')

      for (const account of accounts) {
        const running = await isSyncRunning(account.id)
        if (running) {
          logger.info(
            { accountId: account.id },
            '[ScheduleMeeshoAdsSyncJob] Sync already running — skipping'
          )
          continue
        }

        await SyncMeeshoAdsAccountJob.dispatch({
          accountId: account.id,
          userId: account.userId,
        })

        logger.info(
          { accountId: account.id, userId: account.userId },
          '[ScheduleMeeshoAdsSyncJob] Dispatched Meesho Ads sync job'
        )
      }

      logger.info(
        { accountCount: accounts.length },
        '[ScheduleMeeshoAdsSyncJob] Scheduled sync dispatch complete'
      )
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Scheduler error'
      logger.error({ error: errorMsg }, '[ScheduleMeeshoAdsSyncJob] Failed to dispatch sync jobs')
      throw err
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, '[ScheduleMeeshoAdsSyncJob] Scheduler job failed')
  }
}
