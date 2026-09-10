import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import SyncAdsCampaignsJob from '#jobs/sync_ads_campaigns'
import BulkPauseCampaignsJob from '#jobs/bulk_pause_campaigns'
import { CACHE_PREFIX } from '#services/external_api/constants'
import { ApiError, SessionError } from '#services/external_api/errors'
import cache from '@adonisjs/cache/services/main'
import redis from '@adonisjs/redis/services/main'
import Account from '#models/account'

import transmit from '@adonisjs/transmit/services/main'
import { SessionManager } from '#services/external_api/session_manager'
import { MeeshoApiClient } from '#services/external_api/client'

const PAGE_SIZE = 50

export interface SanitizedCampaign {
  [key: string]: any
  campaign_id: number
  supplier_id?: number
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
export function sanitizeCampaign(
  raw: Record<string, any>,
  fallbackSupplierId?: number
): SanitizedCampaign {
  const perf = raw.perf_details || {}
  const budgetVal = Number(raw.total_budget ?? raw.budget ?? 0)

  return {
    campaign_id: Number(raw.campaign_id ?? raw.id ?? 0),
    supplier_id: Number(raw.supplier_id ?? raw.supplierId ?? fallbackSupplierId ?? 0),
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

  /**
   * POST /accounts/ads/campaigns/pause
   *
   * Pauses an active ad campaign on Meesho.
   * Body: { accountId, campaign_id, supplier_id, pause_nudge_status }
   */
  async pause({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const { accountId, campaign_id, supplier_id, pause_nudge_status } = request.only([
      'accountId',
      'campaign_id',
      'supplier_id',
      'pause_nudge_status',
    ])

    if (!campaign_id) {
      return response.badRequest({ message: 'campaign_id is required' })
    }

    let targetAccountId = accountId

    if (!targetAccountId) {
      const account = await Account.query().where('user_id', user.id).first()
      if (!account) {
        return response.badRequest({ message: 'No account found for user' })
      }
      targetAccountId = account.id
    } else {
      await Account.query().where('id', targetAccountId).where('user_id', user.id).firstOrFail()
    }

    try {
      const client = await MeeshoApiClient.forAccount(targetAccountId.toString())
      const finalSupplierId = Number(supplier_id || client.supplier.supplierId)

      const payload = {
        supplier_id: finalSupplierId,
        campaign_id: Number(campaign_id),
        pause_nudge_status: pause_nudge_status || 'DETAILS_PAGE',
      }

      console.log(
        `[AdsCampaignsController] Pausing campaign ${campaign_id} for supplier ${finalSupplierId} (Account ${targetAccountId})`
      )

      const meeshoRes = await client.post(
        'https://supplier.meesho.com/api/ads/campaigns/pause-campaign',
        payload
      )

      // Evict paused campaign from Redis cache for this account
      const cacheKey = `${CACHE_PREFIX.adsCampaigns}${targetAccountId}:LIVE`
      const redisCache = cache.use('redisOnly')
      try {
        const cached = await redisCache.get<CampaignsData>({ key: cacheKey })
        if (cached && cached.campaigns) {
          const updatedCampaigns = cached.campaigns.filter(
            (c) => Number(c.campaign_id) !== Number(campaign_id)
          )
          await redisCache.set({
            key: cacheKey,
            value: {
              ...cached,
              campaigns: updatedCampaigns,
              totalCount: Math.max(0, (cached.totalCount || 0) - 1),
            },
            ttl: 600,
          })
        }
      } catch (cacheErr) {
        console.warn('[AdsCampaignsController] Failed to update Redis cache after pause:', cacheErr)
      }

      return response.ok({
        success: true,
        message: 'Campaign paused successfully',
        data: meeshoRes.data,
      })
    } catch (error: any) {
      console.error('[AdsCampaignsController] Failed to pause campaign:', error)

      if (error instanceof ApiError) {
        return response.status(error.status || 500).send({
          error: error.message || 'Failed to pause campaign on Meesho',
          status: error.status || 500,
        })
      }

      if (error instanceof SessionError) {
        return response.status(401).send({
          error: `Meesho session expired for account ${targetAccountId}. Please re-login.`,
          status: 401,
        })
      }

      return response.status(500).send({
        error: error.message || 'An unexpected error occurred while pausing campaign',
      })
    }
  }

  /**
   * POST /accounts/ads/campaigns/bulk-pause
   *
   * Enqueues an AdonisJS queue job to pause multiple campaigns across accounts.
   * Body: { items: Array<{ campaign_id: number; accountId: string | number; supplier_id?: number }> }
   */
  /**
   * POST /accounts/ads/campaigns/details
   *
   * Proxies Meesho fetch-campaign-details API for a single campaign.
   * Body: { accountId, campaign_id, supplier_id, page_number?, page_size?, start_date?, end_date?, is_graph_required?, date_window? }
   */
  async campaignDetails({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const {
      accountId,
      campaign_id,
      supplier_id,
      page_number = 1,
      page_size = 10,
      start_date = null,
      end_date = null,
      is_graph_required = true,
      date_window = 'AUTO',
    } = request.only([
      'accountId',
      'campaign_id',
      'supplier_id',
      'page_number',
      'page_size',
      'start_date',
      'end_date',
      'is_graph_required',
      'date_window',
    ])

    if (!campaign_id) {
      return response.badRequest({ message: 'campaign_id is required' })
    }

    let targetAccountId = accountId
    if (!targetAccountId) {
      const account = await Account.query().where('user_id', user.id).first()
      if (!account) {
        return response.badRequest({ message: 'No account found for user' })
      }
      targetAccountId = account.id
    } else {
      await Account.query().where('id', targetAccountId).where('user_id', user.id).firstOrFail()
    }

    try {
      const client = await MeeshoApiClient.forAccount(targetAccountId.toString())
      const finalSupplierId = Number(supplier_id || client.supplier.supplierId)

      const payload = {
        supplier_id: finalSupplierId,
        campaign_id: String(campaign_id),
        page_number: Number(page_number),
        page_size: Number(page_size),
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        is_graph_required: Boolean(is_graph_required),
        date_window: date_window ?? 'AUTO',
      }

      const meeshoRes = await client.post(
        'https://supplier.meesho.com/api/ads/campaigns/fetch-campaign-details',
        payload
      )

      return response.ok({
        success: true,
        data: meeshoRes.data,
      })
    } catch (error: any) {
      if (error instanceof ApiError) {
        return response.status(error.status || 500).send({
          error: error.message || 'Failed to fetch campaign details from Meesho',
          status: error.status || 500,
        })
      }
      if (error instanceof SessionError) {
        return response.status(401).send({
          error: `Meesho session expired for account ${targetAccountId}. Please re-login.`,
          status: 401,
        })
      }
      return response.status(500).send({
        error: error.message || 'An unexpected error occurred while fetching campaign details',
      })
    }
  }

  async bulkPause({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const { items } = request.only(['items'])

    if (!Array.isArray(items) || items.length === 0) {
      return response.badRequest({ message: 'items array is required and cannot be empty' })
    }

    // Verify user owns the unique accounts in items
    const accountIds = Array.from(
      new Set(
        items
          .map((it: any) => Number(it.accountId ?? it.account_id))
          .filter((id) => !isNaN(id) && id > 0)
      )
    )

    const userAccounts = await Account.query().whereIn('id', accountIds).where('user_id', user.id)

    if (userAccounts.length !== accountIds.length) {
      console.warn('[AdsCampaignsController] Account verification failed:', {
        requested: accountIds,
        found: userAccounts.map((a) => a.id),
      })
      return response.forbidden({ message: 'Unauthorized access to one or more accounts' })
    }

    const jobId = randomUUID()

    await BulkPauseCampaignsJob.dispatch({
      jobId,
      userId: user.id,
      items: items.map((it: any) => ({
        campaign_id: Number(it.campaign_id ?? it.campaignId),
        accountId: it.accountId ?? it.account_id,
        supplier_id: it.supplier_id ? Number(it.supplier_id) : undefined,
      })),
    })

    return response.ok({
      message: 'Bulk pause job queued successfully',
      jobId,
      total: items.length,
    })
  }
}
