import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import { syncMeeshoAdsAccount } from '#services/meesho_ads_sync_service'
import logger from '@adonisjs/core/services/logger'
import Ws from '#services/ws'
import redis from '@adonisjs/redis/services/main'

export interface SyncMeeshoAdsAccountPayload {
  accountId: number
  userId: number
  /** Optional: filter by a specific Meesho status (LIVE/PAUSED). Omit to sync ALL. */
  statusFilter?: string
}

/**
 * Background BullMQ job for full Meesho Ads account synchronization.
 *
 * Architecture guarantees:
 * - Distributed Redis lock prevents duplicate concurrent syncs per account.
 * - Missing-campaign detection ONLY fires when ALL pages succeed.
 * - Partial failure leaves existing DB state untouched.
 * - WebSocket broadcasts sync progress/status (NOT campaign data).
 * - PostgreSQL is the source of truth; Redis is only for lock/cache/queue.
 */
export default class SyncMeeshoAdsAccountJob extends Job<SyncMeeshoAdsAccountPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0, // No automatic retries — failed syncs are tracked in ads_sync_runs
  }

  /**
   * Check if a sync is already running/queued for this account before dispatching.
   * Returns true if successfully queued, false if already running.
   */
  static async dispatchIfNotRunning(
    payload: SyncMeeshoAdsAccountPayload
  ): Promise<{ queued: boolean; reason?: string }> {
    const lockKey = `meesho:ads:sync:${payload.accountId}`
    const existingLock = await redis.get(lockKey)

    if (existingLock) {
      logger.info(
        { accountId: payload.accountId, lockKey, existingLock },
        '[SyncMeeshoAdsAccountJob] Sync already running — skipping dispatch'
      )
      return { queued: false, reason: 'already_running' }
    }

    await SyncMeeshoAdsAccountJob.dispatch(payload)
    logger.info(
      { accountId: payload.accountId, userId: payload.userId },
      '[SyncMeeshoAdsAccountJob] Dispatched sync job'
    )
    return { queued: true }
  }

  async execute(): Promise<void> {
    const { accountId, userId, statusFilter } = this.payload

    logger.info({ accountId, userId, statusFilter }, '[SyncMeeshoAdsAccountJob] Job started')

    try {
      const result = await syncMeeshoAdsAccount({
        accountId,
        userId,
        statusFilter,
        signal: this.signal,
      })

      if (result.success) {
        logger.info(
          {
            event: 'meesho_ads_sync_completed',
            accountId,
            syncRunId: result.syncRunId,
            records: result.processedRecords,
            totalRecords: result.totalRecords,
            pages: result.pagesProcessed,
            totalPages: result.totalPages,
            missingMarked: result.missingMarked,
            durationMs: result.durationMs,
          },
          '[SyncMeeshoAdsAccountJob] Sync completed successfully'
        )
      } else {
        logger.warn(
          {
            event: 'meesho_ads_sync_failed',
            accountId,
            syncRunId: result.syncRunId,
            pages: result.pagesProcessed,
            durationMs: result.durationMs,
            error: result.errorMessage,
          },
          '[SyncMeeshoAdsAccountJob] Sync failed — DB state preserved'
        )
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown job error'

      // If the error is a "sync already running" message from the lock check, that's OK
      if (errorMsg.includes('already running')) {
        logger.info(
          { accountId, error: errorMsg },
          '[SyncMeeshoAdsAccountJob] Duplicate job skipped by lock'
        )
        return
      }

      // Unexpected error — broadcast failure
      logger.error(
        { accountId, userId, error: errorMsg },
        '[SyncMeeshoAdsAccountJob] Unexpected job error'
      )

      Ws.broadcast(`accounts/${userId}`, {
        type: 'ads.sync.failed',
        accountId,
        syncRunId: null,
        error: errorMsg,
      })

      // Re-throw so BullMQ marks this as a failed job
      throw err
    }
  }

  async failed(error: Error): Promise<void> {
    const { accountId, userId } = this.payload
    logger.error(
      { accountId, userId, error: error.message },
      '[SyncMeeshoAdsAccountJob] Job permanently failed after exhausted retries'
    )

    Ws.broadcast(`accounts/${userId}`, {
      type: 'ads.sync.failed',
      accountId,
      syncRunId: null,
      error: error.message || 'Background sync permanently failed',
    })
  }
}
