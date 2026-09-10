import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import transmit from '@adonisjs/transmit/services/main'
import cache from '@adonisjs/cache/services/main'
import redis from '@adonisjs/redis/services/main'
import { MeeshoApiClient } from '#services/external_api/client'
import { CACHE_PREFIX } from '#services/external_api/constants'
import { type SanitizedCampaign, sanitizeCampaign } from '#controllers/ads_campaigns_controller'

const MEESHO_CAMPAIGNS_URL = 'https://supplier.meesho.com/api/ads/campaigns/fetch-campaign-list'
const PAGE_SIZE = 50
const PAGE_FETCH_DELAY_MS = 200

export interface SyncAdsCampaignsPayload {
  userId: number
  accountId: number
  accountName: string
  statusFilter: string
  totalCount: number
  startPage: number
}

interface CampaignListResponse {
  data: {
    status_wise_details?: Array<{
      status: string
      count: number
    }>
    campaigns: Record<string, unknown>[]
  }
}

export default class SyncAdsCampaignsJob extends Job<SyncAdsCampaignsPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
  }

  /**
   * Dispatch background sync job via @adonisjs/queue (Redis-backed).
   * Uses Redis atomic SET NX locks to prevent duplicate simultaneous jobs
   * even when worker is offline and user refreshes multiple times.
   */
  static async dispatchSync(payload: SyncAdsCampaignsPayload): Promise<boolean> {
    const queueLockKey = `ads_sync_queued:${payload.accountId}:${payload.statusFilter}`
    const runningLockKey = `ads_sync_running:${payload.accountId}:${payload.statusFilter}`

    try {
      // 1. If job is actively running in a worker, do not queue a duplicate
      const isRunning = await redis.get(runningLockKey)
      if (isRunning) {
        console.log(`[SyncAdsCampaigns] Sync already running for account ${payload.accountId}`)
        return false
      }

      // 2. Atomic SET NX: only queue if not already queued (10 min TTL)
      const acquired = await redis.set(queueLockKey, '1', 'EX', 600, 'NX')
      if (!acquired) {
        console.log(`[SyncAdsCampaigns] Job already queued for account ${payload.accountId}`)
        return false
      }
    } catch (err) {
      console.warn('[SyncAdsCampaigns] Redis lock check error:', err)
    }

    await this.dispatch(payload)
    console.log(
      `[SyncAdsCampaigns] Successfully dispatched sync job for account ${payload.accountId}`
    )
    return true
  }

  async execute(): Promise<void> {
    const { userId, accountId, accountName, statusFilter, startPage } = this.payload
    const runningLockKey = `ads_sync_running:${accountId}:${statusFilter}`
    const queueLockKey = `ads_sync_queued:${accountId}:${statusFilter}`
    const cacheKey = `${CACHE_PREFIX.adsCampaigns}${accountId}:${statusFilter}`
    const redisCache = cache.use('redisOnly')

    // 1. Guard against concurrent duplicate worker execution for the same account
    try {
      const acquiredRunning = await redis.set(runningLockKey, '1', 'EX', 600, 'NX')
      if (!acquiredRunning) {
        console.log(
          `[SyncAdsCampaigns] Another worker is already executing sync for ${accountName} (Account ${accountId}). Skipping duplicate job.`
        )
        return
      }
    } catch (err) {
      console.warn('[SyncAdsCampaigns] Running lock check warning:', err)
    }

    try {
      // 2. Guard: if cache is already complete (e.g. earlier job completed it), do not refetch
      try {
        const cached = await redisCache.get<any>({ key: cacheKey })
        if (cached && cached.isComplete && cached.campaigns && cached.campaigns.length > 0) {
          console.log(
            `[SyncAdsCampaigns] Data already complete in cache for ${accountName} (Account ${accountId}). Skipping redundant sync.`
          )
          transmit.broadcast(`accounts/${userId}`, {
            type: 'ads_fetch_progress',
            accountId,
            accountName,
            currentRecords: cached.campaigns.length,
            totalRecords: cached.totalCount || cached.campaigns.length,
            newCampaigns: [],
            isComplete: true,
          })
          return
        }
      } catch {}

      let totalCount = this.payload.totalCount || 0
      let totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1

      console.log(
        `[SyncAdsCampaigns] Starting background sync for ${accountName} (Account ${accountId}): Start page ${startPage}`
      )

      const client = await MeeshoApiClient.forAccount(accountId.toString())
      let currentTotal = (startPage - 1) * PAGE_SIZE

      for (let page = startPage; page <= totalPages; page++) {
        if (page > startPage) {
          await new Promise((resolve) => setTimeout(resolve, PAGE_FETCH_DELAY_MS))
        }

        try {
          const pageRes = await client.post<CampaignListResponse>(MEESHO_CAMPAIGNS_URL, {
            supplier_id: Number(client.supplier.supplierId),
            perf_details_required: true,
            page_number: page,
            page_size: PAGE_SIZE,
            filter: {
              status: statusFilter,
              is_recommended: false,
              is_sale_consent_tab: false,
              is_cpc_bid_type: false,
            },
          })

          const pageCampaigns = pageRes.data?.data?.campaigns ?? []
          const sanitizedBatch = pageCampaigns.map((c: any) =>
            sanitizeCampaign(c, Number(client.supplier.supplierId))
          )

          // If totalCount is not yet known (e.g. starting from page 1), extract it from status_wise_details
          if (totalCount === 0 || page === 1) {
            const statusDetails = pageRes.data?.data?.status_wise_details
            const statusMatch = Array.isArray(statusDetails)
              ? statusDetails.find(
                  (s) => s.status && s.status.toUpperCase() === statusFilter.toUpperCase()
                )
              : undefined

            if (statusMatch) {
              totalCount = Number(statusMatch.count || 0)
              totalPages = Math.ceil(totalCount / PAGE_SIZE)
            } else {
              totalCount = sanitizedBatch.length
              totalPages = 1
            }
          }

          if (sanitizedBatch.length === 0) {
            break
          }

          currentTotal += sanitizedBatch.length

          // Read existing cache, append, and update Redis
          let mergedCount = currentTotal
          let freshItems = sanitizedBatch
          let isFinished = page >= totalPages || currentTotal >= totalCount
          try {
            const cached = (await redisCache.get<any>({ key: cacheKey })) || { campaigns: [] }
            const existingIds = new Set(cached.campaigns.map((c: any) => c.campaign_id))
            freshItems = sanitizedBatch.filter(
              (c: SanitizedCampaign) => !existingIds.has(c.campaign_id)
            )
            const merged = [...cached.campaigns, ...freshItems]
            mergedCount = merged.length
            isFinished = page >= totalPages || mergedCount >= totalCount

            await redisCache.set({
              key: cacheKey,
              value: {
                campaigns: merged,
                totalCount,
                isComplete: isFinished,
              },
              ttl: '10m',
            })
          } catch (cacheErr) {
            console.error('[SyncAdsCampaigns] Cache update warning:', cacheErr)
          }

          // Broadcast live progress + new batch to user's SSE channel
          transmit.broadcast(`accounts/${userId}`, {
            type: 'ads_fetch_progress',
            accountId,
            accountName,
            currentRecords: Math.min(mergedCount, totalCount),
            totalRecords: totalCount,
            newCampaigns: freshItems,
            isComplete: isFinished,
          })
        } catch (err: any) {
          console.error(
            `[SyncAdsCampaigns] Page ${page} failed for account ${accountId}:`,
            err.message
          )
          transmit.broadcast(`accounts/${userId}`, {
            type: 'ads_fetch_error',
            accountId,
            accountName,
            message: err.message || `Failed to fetch page ${page}`,
            isComplete: true,
          })
          break
        }
      }

      // Mark complete and broadcast final completion
      let finalCount = totalCount
      try {
        const finalCached = (await redisCache.get<any>({ key: cacheKey })) || { campaigns: [] }
        finalCount = finalCached.campaigns?.length || totalCount
        await redisCache.set({
          key: cacheKey,
          value: {
            ...finalCached,
            totalCount: finalCount,
            isComplete: true,
          },
          ttl: '10m',
        })
      } catch {}

      transmit.broadcast(`accounts/${userId}`, {
        type: 'ads_fetch_progress',
        accountId,
        accountName,
        currentRecords: finalCount,
        totalRecords: finalCount,
        newCampaigns: [],
        isComplete: true,
      })

      console.log(
        `[SyncAdsCampaigns] Finished sync for ${accountName}: ${finalCount}/${totalCount} campaigns.`
      )
    } finally {
      // Always release locks so subsequent syncs or force refreshes can proceed
      try {
        await redis.del(runningLockKey)
        await redis.del(queueLockKey)
      } catch {}
    }
  }

  async failed(error: Error): Promise<void> {
    const { userId, accountId, accountName, statusFilter } = this.payload
    const runningLockKey = `ads_sync_running:${accountId}:${statusFilter}`
    const queueLockKey = `ads_sync_queued:${accountId}:${statusFilter}`
    try {
      await redis.del(runningLockKey)
      await redis.del(queueLockKey)
    } catch {}

    transmit.broadcast(`accounts/${userId}`, {
      type: 'ads_fetch_error',
      accountId,
      accountName,
      message: error.message || 'Background sync permanently failed',
      isComplete: true,
    })
  }
}
