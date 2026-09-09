import type { HttpContext } from '@adonisjs/core/http'
import SyncAdsCampaignsJob from '#jobs/sync_ads_campaigns'
import { CACHE_PREFIX } from '#services/external_api/constants'
import { ApiError, SessionError } from '#services/external_api/errors'
import cache from '@adonisjs/cache/services/main'
import redis from '@adonisjs/redis/services/main'
import Account from '#models/account'

import transmit from '@adonisjs/transmit/services/main'
import { SessionManager } from '#services/external_api/session_manager'

const PAGE_SIZE = 50

export interface SanitizedCampaign {
  [key: string]: any
  campaign_id: number
  campaign_name: string
  total_budget: number
  budget: number
  budget_type: string
  start_date: string | null
  end_date: string | null
  perf_details: {
    [key: string]: any
    budget_utilised: number
    total_views: number
    total_clicks: number
    order_count: number
    revenue: number
    roi: number
  }
}

export interface CampaignsData {
  campaigns: SanitizedCampaign[]
  totalCount: number
  isComplete?: boolean
  syncing?: boolean
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function formatBudgetType(rawType: unknown): string {
  if (!rawType) return 'Daily'
  const str = String(rawType).trim()
  const cleaned = str.replace(/_budget$/i, '').split('_')[0]
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() : 'Daily'
}

/**
 * Strips raw bloated Meesho response objects to only the exact fields needed by the UI.
 * Drastically reduces Redis cache footprint, JSON network payload, and memory usage.
 */
export function sanitizeCampaign(raw: Record<string, any>): SanitizedCampaign {
  const perf = raw.perf_details || {}
  const budgetVal = Number(raw.total_budget ?? raw.budget ?? 0)

  return {
    campaign_id: Number(raw.campaign_id ?? raw.id ?? 0),
    campaign_name: String(raw.campaign_name ?? '').trim(),
    total_budget: round2(budgetVal),
    budget: round2(budgetVal),
    budget_type: formatBudgetType(raw.budget_type ?? raw.sub_type ?? raw.campaign_type),
    start_date: raw.start_date ? String(raw.start_date).trim() : null,
    end_date: raw.end_date ? String(raw.end_date).trim() : null,
    perf_details: {
      budget_utilised: round2(Number(perf.budget_utilised ?? perf.budget_spent ?? 0)),
      total_views: Math.round(Number(perf.total_views ?? perf.views ?? perf.impressions ?? 0)),
      total_clicks: Math.round(Number(perf.total_clicks ?? perf.clicks ?? 0)),
      order_count: Math.round(Number(perf.order_count ?? perf.orders ?? 0)),
      revenue: round2(Number(perf.revenue ?? 0)),
      roi: round2(Number(perf.roi ?? perf.roas ?? 0)),
    },
  }
}

export default class AdsCampaignsController {
  /**
   * GET /ads/campaigns/:accountId
   *
   * Fetches campaign pages from Meesho Ads API with:
   *   1. Progressive Streaming: Returns Page 1 immediately (< 800ms)
   *   2. Background Queue Job: Dispatches remaining pages to SyncAdsCampaignsJob
   *   3. Live SSE broadcasts: Streams chunks to accounts/:userId via Transmit
   *   4. Dedicated Redis-only cache layer (10 min TTL, no Node.js heap pollution)
   *   5. Single-flight deduplication & rate limit pacing
   */
  async index({ auth, params, request, response }: HttpContext) {
    const user = await auth.authenticate()

    // Ensure the account belongs to this user
    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    // Optional status filter from query string, defaults to LIVE
    const statusFilter = request.input('status', 'LIVE')
    const forceRefresh = request.input('refresh') === 'true' || request.input('force') === 'true'

    const cacheKey = `${CACHE_PREFIX.adsCampaigns}${account.id}:${statusFilter}`
    const redisCache = cache.use('redisOnly')

    // 1. If force refresh, invalidate existing Redis cache and locks
    if (forceRefresh) {
      try {
        await redisCache.delete({ key: cacheKey })
        await redis.del(`ads_sync_queued:${account.id}:${statusFilter}`)
        await redis.del(`ads_sync_running:${account.id}:${statusFilter}`)
      } catch {}
    } else {
      // Check Redis cache for existing complete data
      try {
        const cached = await redisCache.get<CampaignsData>({ key: cacheKey })
        if (cached && cached.campaigns && cached.campaigns.length > 0 && cached.isComplete) {
          return response.ok({
            data: cached,
            cached: true,
          })
        }
      } catch {
        // Cache read failure shouldn't block execution
      }
    }

    try {
      // Get account name for live user feedback
      const supplierData = await SessionManager.getSupplierData(account.id.toString()).catch(
        () => null
      )
      const accountName = supplierData?.name || account.email || `Account ${account.id}`

      // 1. Check if partial data already exists in Redis (e.g. user reloaded mid-sync)
      const partial = !forceRefresh
        ? await redisCache.get<CampaignsData>({ key: cacheKey }).catch(() => null)
        : null

      let startPage = 1
      let totalCount = 0
      let initialData: CampaignsData = { campaigns: [], totalCount: 0, isComplete: false }

      if (partial && partial.campaigns && partial.campaigns.length > 0) {
        startPage = Math.floor(partial.campaigns.length / PAGE_SIZE) + 1
        totalCount = partial.totalCount
        initialData = partial

        // Broadcast existing campaigns immediately to client
        transmit.broadcast(`accounts/${user.id}`, {
          type: 'ads_fetch_progress',
          accountId: account.id,
          accountName,
          currentRecords: partial.campaigns.length,
          totalRecords: partial.totalCount,
          newCampaigns: partial.campaigns,
        })
      }

      // 2. Dispatch 100% of fetching to AdonisJS queue (starts from Page 1 or resumes from partial)
      await SyncAdsCampaignsJob.dispatchSync({
        userId: user.id,
        accountId: account.id,
        accountName,
        statusFilter,
        totalCount,
        startPage,
      })

      return response.ok({
        data: initialData,
        cached: false,
        syncing: true,
      })
    } catch (error: any) {
      // 4. Stale cache fallback if available from Redis
      try {
        const staleCached = await redisCache.get<CampaignsData>({ key: cacheKey })
        if (staleCached) {
          return response.ok({
            data: staleCached,
            stale: true,
            warning: 'Meesho rate limited or error occurred. Displaying previously cached data.',
          })
        }
      } catch {}

      if (error instanceof ApiError) {
        const is403 = error.status === 403
        return response.status(is403 ? 403 : error.status || 500).send({
          error: is403
            ? 'Meesho temporarily blocked or rate-limited the request (HTTP 403). Please wait a few minutes before trying again.'
            : error.message || 'Failed to fetch campaigns from Meesho',
          status: error.status || 500,
          accountId: account.id,
        })
      }

      if (error instanceof SessionError) {
        return response.status(401).send({
          error: `Meesho session expired for account ${account.id}. Please re-login.`,
          status: 401,
          accountId: account.id,
        })
      }

      return response.status(500).send({
        error: error.message || 'An unexpected error occurred while fetching campaigns',
        status: 500,
        accountId: account.id,
      })
    }
  }
}
