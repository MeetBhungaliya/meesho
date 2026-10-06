import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import BulkPauseCampaignsJob from '#jobs/bulk_pause_campaigns'
import SyncMeeshoAdsAccountJob from '#jobs/sync_meesho_ads_account'
import { ApiError, SessionError } from '#services/external_api/errors'
import Account from '#models/account'
import { MeeshoApiClient } from '#services/external_api/client'
import MeeshoCampaign, { SYNC_STATUS } from '#models/meesho_campaign'
import logger from '@adonisjs/core/services/logger'

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
   * GET /accounts/ads/campaigns/:accountId
   *
   * Reads campaign data directly from PostgreSQL — never calls Meesho API.
   * Background sync (BullMQ) keeps PostgreSQL up-to-date.
   * Response shape is backward-compatible with the old Redis-cached API.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()

    // 1. Parse query parameters
    const accountIdsStr = request.input('accountIds', '')
    const accountIds = accountIdsStr
      .split(',')
      .map((id: string) => Number(id.trim()))
      .filter((id: number) => !isNaN(id) && id > 0)

    if (accountIds.length === 0) {
      return response.badRequest({ message: 'accountIds is required' })
    }

    // Verify user owns these accounts
    const accounts = await Account.query().whereIn('id', accountIds).where('user_id', user.id)
    if (accounts.length !== accountIds.length) {
      return response.forbidden({ message: 'Unauthorized access to one or more accounts' })
    }

    const statusFilter = request.input('status')
    const search = request.input('search', '').trim()
    const sortBy = request.input('sortBy', 'avg_roi')
    const sortOrder = request.input('sortOrder', 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const limit = Math.min(Math.max(Number(request.input('limit', 100)) || 100, 1), 500)
    const cursor = request.input('cursor')

    // Range filters
    const budgetMin = request.input('budgetMin')
    const budgetMax = request.input('budgetMax')
    const spentMin = request.input('spentMin')
    const spentMax = request.input('spentMax')
    const roiMin = request.input('roiMin')
    const roiMax = request.input('roiMax')
    const ordersMin = request.input('ordersMin')
    const ordersMax = request.input('ordersMax')
    const revenueMin = request.input('revenueMin')
    const revenueMax = request.input('revenueMax')
    const viewsMin = request.input('viewsMin')
    const viewsMax = request.input('viewsMax')
    const clicksMin = request.input('clicksMin')
    const clicksMax = request.input('clicksMax')

    // 2. Map sort field
    const SORT_FIELD_MAP: Record<string, string> = {
      campaign_name: 'campaign_name',
      budget: 'total_budget',
      budget_utilized: 'budget_utilised',
      views: 'total_views',
      clicks: 'total_clicks',
      orders: 'order_count',
      revenue: 'revenue',
      avg_roi: 'roi',
    }

    const sortColumn = SORT_FIELD_MAP[sortBy] || 'roi'

    try {
      const query = MeeshoCampaign.query()
        .whereIn('account_id', accountIds)
        .where('sync_status', SYNC_STATUS.PRESENT)

      if (statusFilter) query.where('status', statusFilter.toUpperCase())
      if (search) {
        // ILIKE for case-insensitive search
        query.where((q) => {
          q.where('campaign_name', 'ilike', `%${search}%`).orWhere(
            'campaign_id',
            'ilike',
            `%${search}%`
          )
        })
      }

      // Apply range filters
      if (budgetMin) query.where('total_budget', '>=', Number(budgetMin))
      if (budgetMax) query.where('total_budget', '<=', Number(budgetMax))
      if (spentMin) query.where('budget_utilised', '>=', Number(spentMin))
      if (spentMax) query.where('budget_utilised', '<=', Number(spentMax))
      if (roiMin) query.where('roi', '>=', Number(roiMin))
      if (roiMax) query.where('roi', '<=', Number(roiMax))
      if (ordersMin) query.where('order_count', '>=', Number(ordersMin))
      if (ordersMax) query.where('order_count', '<=', Number(ordersMax))
      if (revenueMin) query.where('revenue', '>=', Number(revenueMin))
      if (revenueMax) query.where('revenue', '<=', Number(revenueMax))
      if (viewsMin) query.where('total_views', '>=', Number(viewsMin))
      if (viewsMax) query.where('total_views', '<=', Number(viewsMax))
      if (clicksMin) query.where('total_clicks', '>=', Number(clicksMin))
      if (clicksMax) query.where('total_clicks', '<=', Number(clicksMax))

      // Apply cursor
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
          const val = decoded.v
          const id = decoded.id

          if (val !== undefined && id !== undefined) {
            query.where((q) => {
              if (sortOrder === 'desc') {
                q.where(sortColumn, '<', val).orWhere((qq) => {
                  qq.where(sortColumn, val).where('id', '<', id)
                })
              } else {
                q.where(sortColumn, '>', val).orWhere((qq) => {
                  qq.where(sortColumn, val).where('id', '>', id)
                })
              }
            })
          }
        } catch (err) {
          logger.warn({ cursor }, '[AdsCampaignsController] Invalid cursor format')
        }
      }

      // Apply sorting
      // We use id as tie-breaker
      query.orderByRaw(
        `${sortColumn} ${sortOrder === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}`
      )
      query.orderBy('id', sortOrder)

      // Limit + 1 to check if hasMore
      query.limit(limit + 1)

      const campaigns = await query

      const hasMore = campaigns.length > limit
      const recordsToReturn = hasMore ? campaigns.slice(0, limit) : campaigns

      let nextCursor: string | null = null
      if (hasMore) {
        const lastRecord = recordsToReturn[recordsToReturn.length - 1]
        // @ts-ignore - dynamic access
        const val =
          lastRecord[sortColumn.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] ??
          lastRecord.$extras[sortColumn] ??
          lastRecord.serialize()[sortColumn.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]

        let cursorVal = val
        if (sortColumn === 'campaign_name') {
          cursorVal = lastRecord.campaignName
        } else if (sortColumn === 'total_budget') {
          cursorVal = lastRecord.totalBudget
        } else if (sortColumn === 'budget_utilised') {
          cursorVal = lastRecord.budgetUtilised
        } else if (sortColumn === 'total_views') {
          cursorVal = lastRecord.totalViews
        } else if (sortColumn === 'total_clicks') {
          cursorVal = lastRecord.totalClicks
        } else if (sortColumn === 'order_count') {
          cursorVal = lastRecord.orderCount
        } else if (sortColumn === 'revenue') {
          cursorVal = lastRecord.revenue
        } else if (sortColumn === 'roi') {
          cursorVal = lastRecord.roi
        }

        // Handle numeric conversion just to be safe
        cursorVal =
          typeof cursorVal === 'object' && cursorVal?.toString
            ? Number(cursorVal.toString())
            : cursorVal
        if (
          typeof cursorVal === 'string' &&
          !isNaN(Number(cursorVal)) &&
          sortColumn !== 'campaign_name'
        ) {
          cursorVal = Number(cursorVal)
        }

        nextCursor = Buffer.from(JSON.stringify({ v: cursorVal, id: lastRecord.id })).toString(
          'base64'
        )
      }

      // Get count if first page (cursor not provided)
      let totalCount = 0
      let aggregates = {}
      if (!cursor) {
        const countQuery = query
          .clone()
          .clearOrder()
          .clearLimit()
          .clearSelect()
          .count('* as total')
          .first()
        const countRes = await countQuery
        totalCount = Number(countRes?.$extras.total || 0)

        // Get global aggregates across these accounts for filter limits (ignoring current range/search filters)
        const aggQuery = MeeshoCampaign.query()
          .whereIn('account_id', accountIds)
          .where('sync_status', SYNC_STATUS.PRESENT)
          .clearSelect()
          .min('total_budget as min_budget')
          .max('total_budget as max_budget')
          .min('budget_utilised as min_spent')
          .max('budget_utilised as max_spent')
          .min('roi as min_roi')
          .max('roi as max_roi')
          .min('order_count as min_orders')
          .max('order_count as max_orders')
          .min('revenue as min_revenue')
          .max('revenue as max_revenue')
          .min('total_views as min_views')
          .max('total_views as max_views')
          .min('total_clicks as min_clicks')
          .max('total_clicks as max_clicks')
          .first()

        const aggRes = await aggQuery
        if (aggRes) {
          aggregates = {
            budget: {
              min: Number(aggRes.$extras.min_budget || 0),
              max: Number(aggRes.$extras.max_budget || 0),
            },
            budget_utilized: {
              min: Number(aggRes.$extras.min_spent || 0),
              max: Number(aggRes.$extras.max_spent || 0),
            },
            avg_roi: {
              min: Number(aggRes.$extras.min_roi || 0),
              max: Number(aggRes.$extras.max_roi || 0),
            },
            orders: {
              min: Number(aggRes.$extras.min_orders || 0),
              max: Number(aggRes.$extras.max_orders || 0),
            },
            revenue: {
              min: Number(aggRes.$extras.min_revenue || 0),
              max: Number(aggRes.$extras.max_revenue || 0),
            },
            views: {
              min: Number(aggRes.$extras.min_views || 0),
              max: Number(aggRes.$extras.max_views || 0),
            },
            clicks: {
              min: Number(aggRes.$extras.min_clicks || 0),
              max: Number(aggRes.$extras.max_clicks || 0),
            },
          }
        }
      }

      const sanitized = recordsToReturn.map((c) => ({
        account_id: c.accountId, // Ensure frontend knows which account this belongs to
        campaign_id: c.campaignId,
        campaign_name: c.campaignName,
        total_budget: Number(c.totalBudget),
        budget: Number(c.totalBudget),
        budget_type: c.budgetType || 'DAILY_BUDGET',
        start_date: c.startDate?.toISO() ?? null,
        end_date: null,
        status: c.status,
        campaign_type: c.campaignType,
        catalog_id: c.catalogId,
        sync_status: c.syncStatus,
        perf_details: {
          budget_utilised: Number(c.budgetUtilised),
          total_views: Number(c.totalViews),
          total_clicks: Number(c.totalClicks),
          order_count: Number(c.orderCount),
          revenue: Number(c.revenue),
          roi: Number(c.roi),
          cpc: Number(c.cpc),
          conversion_rate: Number(c.conversionRate),
        },
      }))

      return response.ok({
        data: sanitized,
        pagination: {
          nextCursor,
          hasMore,
        },
        meta: {
          total: totalCount,
          aggregates,
        },
      })
    } catch (error: any) {
      logger.error(
        { error: error.message },
        '[AdsCampaignsController] Failed to fetch campaigns from DB'
      )
      return response.status(500).send({
        error: error.message || 'Failed to fetch campaigns',
        status: 500,
      })
    }
  }

  /**
   * POST /accounts/ads/campaigns/:accountId/sync
   *
   * Triggers a background Meesho Ads sync for a specific account.
   * Returns immediately — sync happens in the background.
   * Prevents duplicate syncs using Redis distributed lock.
   */
  async triggerSync({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    const result = await SyncMeeshoAdsAccountJob.dispatchIfNotRunning({
      accountId: account.id,
      userId: user.id,
    })

    if (!result.queued) {
      return response.ok({
        queued: false,
        reason: result.reason || 'already_running',
        message: 'A sync is already running for this account',
      })
    }

    return response.ok({
      queued: true,
      message: 'Background sync started',
    })
  }

  /**
   * POST /accounts/ads/campaigns/pause
   *
   * Pauses an active ad campaign on Meesho.
   * Body: { accountId, campaign_id, supplier_id, pause_nudge_status }
   */
  async pause({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const {
      accountId,
      campaign_id: campaignId,
      supplier_id: supplierId,
      pause_nudge_status: pauseNudgeStatus,
    } = request.only(['accountId', 'campaign_id', 'supplier_id', 'pause_nudge_status'])

    if (!campaignId) {
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
      const finalSupplierId = Number(supplierId || client.supplier.supplierId)

      const payload = {
        supplier_id: finalSupplierId,
        campaign_id: Number(campaignId),
        pause_nudge_status: pauseNudgeStatus || 'DETAILS_PAGE',
      }

      console.log(
        `[AdsCampaignsController] Pausing campaign ${campaignId} for supplier ${finalSupplierId} (Account ${targetAccountId})`
      )

      const meeshoRes = await client.post(
        'https://supplier.meesho.com/api/ads/campaigns/pause-campaign',
        payload
      )

      // Evict paused campaign from PostgreSQL cache for this account
      try {
        await MeeshoCampaign.query()
          .where('account_id', targetAccountId)
          .where('campaign_id', campaignId)
          .update({ status: 'PAUSED' })
      } catch (dbErr) {
        console.warn(
          `[AdsCampaignsController] Failed to update PostgreSQL status for campaign ${campaignId}:`,
          dbErr
        )
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
   * POST /accounts/ads/campaigns/edit-catalogs
   *
   * Updates a catalog bid / CPO on Meesho.
   * Body: { accountId, campaign_id, supplier_id, catalog_id, bid, prefilled_input_value }
   */
  async editCatalogs({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const {
      accountId,
      campaign_id: campaignId,
      supplier_id: supplierId,
      catalog_id: catalogId,
      bid,
      prefilled_input_value: prefilledInputValue,
    } = request.only([
      'accountId',
      'campaign_id',
      'supplier_id',
      'catalog_id',
      'bid',
      'prefilled_input_value',
    ])

    if (!campaignId || !catalogId || bid === null || bid === undefined) {
      return response.badRequest({ message: 'campaign_id, catalog_id, and bid are required' })
    }

    let targetAccountId = accountId
    if (!targetAccountId) {
      const account = await Account.query().where('user_id', user.id).first()
      if (!account) return response.badRequest({ message: 'No account found for user' })
      targetAccountId = account.id
    } else {
      await Account.query().where('id', targetAccountId).where('user_id', user.id).firstOrFail()
    }

    try {
      const client = await MeeshoApiClient.forAccount(targetAccountId.toString())
      const finalSupplierId = Number(supplierId || client.supplier.supplierId)
      const payload = {
        supplier_id: finalSupplierId,
        campaign_id: Number(campaignId),
        catalog_id: Number(catalogId),
        bid: Number(bid),
        prefilled_input_value: Number(prefilledInputValue || bid),
      }

      const meeshoRes = await client.post(
        'https://supplier.meesho.com/api/ads/campaigns/edit-catalogs',
        payload
      )

      return response.ok({
        success: true,
        message: 'Catalog bid updated successfully',
        data: meeshoRes,
      })
    } catch (error: any) {
      if (error instanceof ApiError) {
        return response.status(error.status || 500).send({
          error: error.message || 'Failed to update catalog bid on Meesho',
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
        error: error.message || 'An unexpected error occurred while updating catalog bid',
      })
    }
  }

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
      campaign_id: campaignId,
      supplier_id: supplierId,
      page_number: pageNumber = 1,
      page_size: pageSize = 10,
      start_date: startDate = null,
      end_date: endDate = null,
      is_graph_required: isGraphRequired = true,
      date_window: dateWindow = 'AUTO',
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

    if (!campaignId) {
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
      const finalSupplierId = Number(supplierId || client.supplier.supplierId)

      const payload = {
        supplier_id: finalSupplierId,
        campaign_id: String(campaignId),
        page_number: Number(pageNumber),
        page_size: Number(pageSize),
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        is_graph_required: Boolean(isGraphRequired),
        date_window: dateWindow ?? 'AUTO',
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

  /**
   * POST /accounts/ads/campaigns/bulk-pause
   *
   * Enqueues an AdonisJS queue job to pause multiple campaigns across accounts.
   * Body: { items: Array<{ campaign_id: number; accountId: string | number; supplier_id?: number }> }
   */
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
          .filter((id) => !Number.isNaN(id) && id > 0)
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
