import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import transmit from '@adonisjs/transmit/services/main'
import { MeeshoApiClient } from '#services/external_api/client'
import { ApiError } from '#services/external_api/errors'
import { JobStateManager } from '#services/job_state_manager'
import { CACHE_PREFIX } from '#services/external_api/constants'
import cache from '@adonisjs/cache/services/main'
import type { CampaignsData } from '#controllers/ads_campaigns_controller'

export interface BulkPauseCampaignItem {
  campaign_id: number
  accountId: string | number
  supplier_id?: number
}

export interface BulkPauseCampaignsPayload {
  jobId: string
  userId: number
  items: BulkPauseCampaignItem[]
}

interface FailedItem {
  [key: string]: any
  campaign_id: number
  accountId: string | number
  reason: string
}

export default class BulkPauseCampaignsJob extends Job<BulkPauseCampaignsPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 1,
  }

  async execute() {
    const { jobId, userId, items } = this.payload
    const channelName = `bulk-pause-ads:${jobId}`
    const total = items.length

    console.log(
      `[BulkPauseCampaignsJob] Starting job ${jobId} for user ${userId} with ${total} campaigns`
    )

    // 1. Initialize persistent state in Redis
    await JobStateManager.initJob(channelName, total)

    transmit.broadcast(channelName, {
      type: 'started',
      total,
    })

    transmit.broadcast(`accounts/${userId}`, {
      type: 'bulk_pause_started',
      jobId,
      total,
    })

    let successCount = 0
    let failedCount = 0
    const failedItems: FailedItem[] = []
    const clientCache = new Map<string, MeeshoApiClient>()
    const affectedAccounts = new Set<string>()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const accIdStr = (item.accountId ?? (item as any).account_id).toString()
      affectedAccounts.add(accIdStr)

      try {
        let client = clientCache.get(accIdStr)
        if (!client) {
          client = await MeeshoApiClient.forAccount(accIdStr)
          clientCache.set(accIdStr, client)
        }

        const supplierId = Number(item.supplier_id || client.supplier.supplierId)
        const payload = {
          supplier_id: supplierId,
          campaign_id: Number(item.campaign_id),
          pause_nudge_status: 'DETAILS_PAGE',
        }

        console.log(
          `[BulkPauseCampaignsJob] [${i + 1}/${total}] Pausing campaign ${item.campaign_id} for account ${accIdStr} (supplier ${supplierId})...`
        )

        await client.post('https://supplier.meesho.com/api/ads/campaigns/pause-campaign', payload)

        successCount++
        console.log(`[BulkPauseCampaignsJob] Successfully paused campaign ${item.campaign_id}`)

        // Evict paused campaign from Redis cache for this account
        const cacheKey = `${CACHE_PREFIX.adsCampaigns}${accIdStr}:LIVE`
        const redisCache = cache.use('redisOnly')
        try {
          const cached = await redisCache.get<CampaignsData>({ key: cacheKey })
          if (cached && cached.campaigns) {
            const updated = cached.campaigns.filter(
              (c) => Number(c.campaign_id) !== Number(item.campaign_id)
            )
            await redisCache.set({
              key: cacheKey,
              value: {
                ...cached,
                campaigns: updated,
                totalCount: Math.max(0, (cached.totalCount || 0) - 1),
              },
              ttl: 600,
            })
          }
        } catch (err) {
          console.warn(
            `[BulkPauseCampaignsJob] Failed to update Redis cache for account ${accIdStr}:`,
            err
          )
        }

        await JobStateManager.updateProgress(channelName, {
          processed: i + 1,
          itemId: item.campaign_id.toString(),
          status: 'success',
          itemType: 'productId',
        })

        transmit.broadcast(channelName, {
          type: 'progress',
          processed: i + 1,
          total,
          campaign_id: item.campaign_id,
          accountId: item.accountId,
          status: 'success',
          successCount,
          failedCount,
        })

        transmit.broadcast(`accounts/${userId}`, {
          type: 'bulk_pause_progress',
          jobId,
          processed: i + 1,
          total,
          campaign_id: item.campaign_id,
          accountId: item.accountId,
          status: 'success',
        })
      } catch (error) {
        failedCount++
        const reason = error instanceof ApiError ? error.message : (error as Error).message
        console.error(
          `[BulkPauseCampaignsJob] Failed to pause campaign ${item.campaign_id} for account ${accIdStr}:`,
          reason
        )
        failedItems.push({ campaign_id: item.campaign_id, accountId: item.accountId, reason })

        await JobStateManager.updateProgress(channelName, {
          processed: i + 1,
          itemId: item.campaign_id.toString(),
          status: 'failed',
          error: reason,
          itemType: 'productId',
        })

        transmit.broadcast(channelName, {
          type: 'progress',
          processed: i + 1,
          total,
          campaign_id: item.campaign_id,
          accountId: item.accountId,
          status: 'failed',
          error: reason,
          successCount,
          failedCount,
        })
      }

      // Small pacing delay to respect Meesho rate limits
      if (i < items.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    // Complete job
    await JobStateManager.completeJob(channelName, { successCount, failedCount, failedItems })

    transmit.broadcast(channelName, {
      type: 'completed',
      successCount,
      failedCount,
      failedItems,
    })

    transmit.broadcast(`accounts/${userId}`, {
      type: 'bulk_pause_completed',
      jobId,
      successCount,
      failedCount,
      failedItems,
    })

    console.log(
      `[BulkPauseCampaignsJob] Completed job ${jobId}. Success: ${successCount}, Failed: ${failedCount}`
    )
  }

  async failed(error: Error) {
    const channelName = `bulk-pause-ads:${this.payload.jobId}`
    console.error(
      `[BulkPauseCampaignsJob] Unrecoverable error on job ${this.payload.jobId}:`,
      error.message
    )

    await JobStateManager.errorJob(channelName, error.message)

    transmit.broadcast(channelName, {
      type: 'error',
      message: error.message,
    })

    transmit.broadcast(`accounts/${this.payload.userId}`, {
      type: 'bulk_pause_error',
      jobId: this.payload.jobId,
      message: error.message,
    })
  }
}
