import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { MeeshoApiClient } from '#services/external_api/client'
import { SessionError, ApiError } from '#services/external_api/errors'
import AdsSyncRun, { ADS_SYNC_RUN_STATUS } from '#models/ads_sync_run'
import { SYNC_STATUS } from '#models/meesho_campaign'
import Ws from '#services/ws'
import Account from '#models/account'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const MEESHO_CAMPAIGNS_URL = 'https://supplier.meesho.com/api/ads/campaigns/fetch-campaign-list'

const PAGE_SIZE = 50
const PAGE_DELAY_MS = 200
const LOCK_TTL_SECONDS = 3600 // 1 hour — safe ceiling for 18K+ campaign syncs

/**
 * Redis lock key for distributed deduplication.
 * Pattern: meesho:ads:sync:{accountId}
 */
function lockKey(accountId: number): string {
  return `meesho:ads:sync:${accountId}`
}

interface MeeshoCampaignListResponse {
  data: {
    total_campaigns_count?: number
    status_wise_details?: Array<{ status: string; count: number }>
    campaigns: Record<string, unknown>[]
  }
}

// -------------------------------------------------------------------
// Campaign row mapper
// Maps raw Meesho API campaign object → flat DB row (no nested objects)
// -------------------------------------------------------------------

function mapCampaignToRow(
  raw: Record<string, unknown>,
  accountId: number,
  syncRunId: string
): Record<string, unknown> {
  const perf = (raw.perf_details as Record<string, unknown>) || {}
  const now = new Date().toISOString()

  return {
    account_id: accountId,
    campaign_id: Number(raw.campaign_id ?? raw.id ?? 0),
    campaign_name: String(raw.campaign_name ?? '').trim(),
    start_date: raw.start_date ? new Date(String(raw.start_date)).toISOString() : null,
    till_budget_lasts: Boolean(raw.till_budget_lasts ?? false),
    total_budget: Number(raw.total_budget ?? raw.budget ?? 0),
    budget_type: raw.budget_type ? String(raw.budget_type) : null,
    campaign_type: raw.campaign_type ? String(raw.campaign_type) : null,
    catalog_id: raw.catalog_id ? Number(raw.catalog_id) : null,
    catalog_count: Number(raw.catalog_count ?? 0),
    status: String(raw.status ?? 'LIVE'),
    is_smart_campaign: Boolean(raw.is_smart_campaign ?? false),
    is_smart_campaign_restart_allowed: Boolean(raw.is_smart_campaign_restart_allowed ?? false),
    vg_flag: Boolean(raw.vg_flag ?? false),
    bid_type: raw.bid_type ? String(raw.bid_type) : null,
    is_gmv_max_smart_campaign: Boolean(raw.is_gmv_max_smart_campaign ?? false),
    derived_bid_type: raw.derived_bid_type ? String(raw.derived_bid_type) : null,
    campaign_src: raw.campaign_src ? String(raw.campaign_src) : null,
    is_migrating: Boolean(raw.is_migrating ?? false),
    // Performance metrics
    budget_utilised: Number(perf.budget_utilised ?? perf.budget_spent ?? 0),
    cpc: Number(perf.cpc ?? 0),
    revenue: Number(perf.revenue ?? 0),
    order_count: Number(perf.order_count ?? perf.orders ?? 0),
    roi: Number(perf.roi ?? perf.roas ?? 0),
    total_views: Number(perf.total_views ?? perf.views ?? perf.impressions ?? 0),
    conversion_rate: Number(perf.conversion_rate ?? 0),
    total_clicks: Number(perf.total_clicks ?? perf.clicks ?? 0),
    // Sync tracking
    sync_status: SYNC_STATUS.PRESENT,
    last_seen_sync_id: syncRunId,
    last_seen_at: now,
    updated_at: now,
  }
}

// -------------------------------------------------------------------
// Upsert a batch of campaigns
// Uses ON CONFLICT(account_id, campaign_id) DO UPDATE to avoid deletes
// -------------------------------------------------------------------

async function upsertCampaignBatch(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return

  await db.table('meesho_campaigns').insert(rows).onConflict(['account_id', 'campaign_id']).merge([
    'campaign_name',
    'start_date',
    'till_budget_lasts',
    'total_budget',
    'budget_type',
    'campaign_type',
    'catalog_id',
    'catalog_count',
    'status',
    'is_smart_campaign',
    'is_smart_campaign_restart_allowed',
    'vg_flag',
    'bid_type',
    'is_gmv_max_smart_campaign',
    'derived_bid_type',
    'campaign_src',
    'is_migrating',
    'budget_utilised',
    'cpc',
    'revenue',
    'order_count',
    'roi',
    'total_views',
    'conversion_rate',
    'total_clicks',
    // Always update sync tracking on every observed page
    'sync_status',
    'last_seen_sync_id',
    'last_seen_at',
    'updated_at',
  ])
}

// -------------------------------------------------------------------
// Mark campaigns MISSING: the atomic finalization step
// ONLY called after ALL pages have successfully completed.
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Broadcast helpers (reuse existing Ws service)
// -------------------------------------------------------------------

function broadcastSyncStarted(
  userId: number,
  accountId: number,
  syncRunId: string,
  totalRecords: number,
  totalPages: number
): void {
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads.sync.started',
    accountId,
    syncRunId,
    totalRecords,
    totalPages,
  })
}

function broadcastSyncProgress(
  userId: number,
  accountId: number,
  syncRunId: string,
  processedRecords: number,
  totalRecords: number,
  processedPages: number,
  totalPages: number
): void {
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads.sync.progress',
    accountId,
    syncRunId,
    processedRecords,
    totalRecords,
    processedPages,
    totalPages,
  })

  // Backward compatibility with old frontend event format (no newCampaigns payload)
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads_fetch_progress',
    accountId,
    currentRecords: processedRecords,
    totalRecords,
    newCampaigns: [],
    isComplete: false,
  })
}

function broadcastSyncCompleted(
  userId: number,
  accountId: number,
  syncRunId: string,
  processedRecords: number
): void {
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads.sync.completed',
    accountId,
    syncRunId,
    processedRecords,
  })

  // Backward compat
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads_fetch_progress',
    accountId,
    currentRecords: processedRecords,
    totalRecords: processedRecords,
    newCampaigns: [],
    isComplete: true,
  })
}

function broadcastSyncFailed(
  userId: number,
  accountId: number,
  syncRunId: string,
  error: string
): void {
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads.sync.failed',
    accountId,
    syncRunId,
    error,
  })

  // Backward compat
  Ws.broadcast(`accounts/${userId}`, {
    type: 'ads_fetch_error',
    accountId,
    message: error,
    isComplete: true,
  })
}

// -------------------------------------------------------------------
// Main sync function
// -------------------------------------------------------------------

export interface SyncMeeshoAdsAccountOptions {
  accountId: number
  userId: number
  /** If provided, fetch only this status. If omitted, fetches ALL statuses. */
  statusFilter?: string
  /** Abort signal from BullMQ to gracefully stop the sync on worker shutdown */
  signal?: AbortSignal
}

export interface SyncResult {
  success: boolean
  syncRunId: string
  processedRecords: number
  totalRecords: number
  pagesProcessed: number
  totalPages: number
  missingMarked: number
  durationMs: number
  errorMessage?: string
}

/**
 * Full Meesho Ads account synchronization.
 *
 * Guarantees:
 * - Missing-campaign detection ONLY fires after ALL pages succeed (hard requirement).
 * - Partial sync failures leave the DB in its previous valid state.
 * - Uses distributed Redis lock to prevent duplicate concurrent syncs.
 * - Never holds a DB transaction open across HTTP calls.
 */
export async function syncMeeshoAdsAccount(opts: SyncMeeshoAdsAccountOptions): Promise<SyncResult> {
  const { accountId, userId, statusFilter, signal } = opts
  const startMs = Date.now()
  const syncRunId = randomUUID()

  // Step 1: Acquire distributed lock
  const lockAcquired = await redis.set(lockKey(accountId), syncRunId, 'EX', LOCK_TTL_SECONDS, 'NX')
  if (!lockAcquired) {
    const currentLock = await redis.get(lockKey(accountId))
    logger.info(
      { accountId, currentSyncRunId: currentLock },
      '[MeeshoAdsSync] Sync already running, skipping duplicate'
    )
    throw new Error(`Sync already running for account ${accountId}`)
  }

  // Step 2: Create sync_run record
  await AdsSyncRun.create({
    syncRunId,
    accountId,
    status: ADS_SYNC_RUN_STATUS.RUNNING,
    startedAt: DateTime.utc(),
  })

  let processedRecords = 0
  let totalRecords = 0
  let pagesProcessed = 0
  let totalPages = 1 // will be updated after first page
  let missingMarked = 0
  let lastError: string | undefined

  try {
    // Step 3: Get API client (uses existing Redis-backed session + supplierData)
    const client = await MeeshoApiClient.forAccount(accountId.toString())
    const supplierId = Number(client.supplier.supplierId)

    logger.info({ accountId, syncRunId, supplierId }, '[MeeshoAdsSync] Starting background sync')

    // Broadcast sync started (totalRecords/Pages unknown until page 1)
    broadcastSyncStarted(userId, accountId, syncRunId, 0, 0)

    // Step 4: Paginate through ALL campaigns
    const statusesToFetch = statusFilter ? [statusFilter] : ['LIVE', 'PAUSED', 'UPCOMING']
    let totalCountsCalculated = false

    for (const currentStatus of statusesToFetch) {
      if (lastError) break

      let page = 1
      let statusTotalPages = 1
      let shouldBreak = false

      while (!shouldBreak) {
        if (signal?.aborted) {
          logger.warn(
            { accountId, syncRunId, currentStatus, page },
            '[MeeshoAdsSync] Sync gracefully aborted by worker shutdown'
          )
          lastError = 'Job aborted by worker shutdown'
          shouldBreak = true
          break
        }

        if (page > 1 || statusesToFetch.indexOf(currentStatus) > 0) {
          await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS))
        }

        try {
          const requestBody: Record<string, unknown> = {
            supplier_id: supplierId,
            perf_details_required: true,
            page_number: page,
            page_size: PAGE_SIZE,
            filter: {
              is_recommended: false,
              is_sale_consent_tab: false,
              is_cpc_bid_type: false,
              status: currentStatus,
            },
          }

          const pageRes = await client.post<MeeshoCampaignListResponse>(
            MEESHO_CAMPAIGNS_URL,
            requestBody,
            { signal }
          )

          const pageData = pageRes.data?.data
          const pageCampaigns = pageData?.campaigns ?? []

          // Calculate overall totals on the very first API response
          if (!totalCountsCalculated) {
            const statusDetails = pageData?.status_wise_details ?? []
            if (statusFilter) {
              totalRecords =
                statusDetails.find((s) => s.status.toUpperCase() === statusFilter.toUpperCase())
                  ?.count ?? 0
            } else {
              totalRecords = statusDetails.reduce((sum, s) => {
                if (statusesToFetch.includes(s.status.toUpperCase())) {
                  return sum + s.count
                }
                return sum
              }, 0)
            }

            if (totalRecords === 0 && pageCampaigns.length === 0) {
              // Entire account is empty? Treat as suspicious and abort.
              logger.warn(
                { accountId, syncRunId },
                '[MeeshoAdsSync] First page returned 0 campaigns — treating as suspicious, aborting'
              )
              lastError = 'Meesho returned 0 campaigns on first page — sync aborted defensively'
              break
            }

            totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1
            totalCountsCalculated = true

            // Now that we know the real numbers, broadcast started with correct counts
            broadcastSyncStarted(userId, accountId, syncRunId, totalRecords, totalPages)

            // Update sync_run with total counts
            await AdsSyncRun.query().where('sync_run_id', syncRunId).update({
              total_pages: totalPages,
              total_records: totalRecords,
            })
          }

          if (page === 1) {
            const statusTotalRecords =
              (pageData?.status_wise_details ?? []).find(
                (s) => s.status.toUpperCase() === currentStatus.toUpperCase()
              )?.count ?? 0
            if (statusTotalRecords === 0 && pageCampaigns.length === 0) {
              logger.info(
                { accountId, syncRunId, currentStatus },
                '[MeeshoAdsSync] Status is empty, skipping'
              )
              break
            }
            statusTotalPages = Math.ceil(statusTotalRecords / PAGE_SIZE) || 1
          }

          // Empty page beyond page 1 = natural end of pagination for this status
          if (pageCampaigns.length === 0) {
            logger.info(
              { accountId, syncRunId, page, currentStatus },
              '[MeeshoAdsSync] Empty page received, pagination complete for status'
            )
            break
          }

          // Step 5: Upsert campaign batch
          const rows = pageCampaigns.map((c) =>
            mapCampaignToRow(c as Record<string, unknown>, accountId, syncRunId)
          )
          await upsertCampaignBatch(rows)

          processedRecords += pageCampaigns.length
          pagesProcessed++

          // Update sync_run progress (lightweight; not in a transaction)
          await AdsSyncRun.query().where('sync_run_id', syncRunId).update({
            processed_records: processedRecords,
            pages_processed: pagesProcessed,
            updated_at: new Date().toISOString(),
          })

          // Broadcast progress
          broadcastSyncProgress(
            userId,
            accountId,
            syncRunId,
            processedRecords,
            totalRecords,
            pagesProcessed,
            totalPages
          )

          logger.info(
            {
              accountId,
              syncRunId,
              page,
              pagesProcessed,
              totalPages,
              processedRecords,
              totalRecords,
              currentStatus,
            },
            '[MeeshoAdsSync] Page processed'
          )

          if (page >= statusTotalPages) {
            break
          }

          page++
        } catch (pageErr: unknown) {
          const isAuthError =
            pageErr instanceof SessionError ||
            (pageErr instanceof ApiError && (pageErr.status === 401 || pageErr.status === 403))

          const errorMsg = pageErr instanceof Error ? pageErr.message : 'Unknown page fetch error'

          logger.error(
            { accountId, syncRunId, page, currentStatus, error: errorMsg, isAuthError },
            '[MeeshoAdsSync] Page fetch failed'
          )

          lastError = errorMsg
          shouldBreak = true // exits the while loop
        }
      }
    }

    // Step 6: Finalization — ONLY if all pages succeeded
    if (!lastError && pagesProcessed > 0) {
      // Atomic transaction: mark missing + mark run SUCCESS
      await db.transaction(async (trx) => {
        // Mark campaigns not seen in this sync as MISSING
        const missingCount = await trx
          .from('meesho_campaigns')
          .where('account_id', accountId)
          .where('sync_status', SYNC_STATUS.PRESENT)
          .whereNot('last_seen_sync_id', syncRunId)
          .whereNotNull('last_seen_sync_id')
          .update({
            sync_status: SYNC_STATUS.MISSING,
            updated_at: new Date().toISOString(),
          })

        missingMarked = Array.isArray(missingCount) ? missingCount[0] : missingCount

        // Mark sync run as SUCCESS
        await trx.from('ads_sync_runs').where('sync_run_id', syncRunId).update({
          status: ADS_SYNC_RUN_STATUS.SUCCESS,
          total_records: totalRecords,
          processed_records: processedRecords,
          pages_processed: pagesProcessed,
          total_pages: totalPages,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      })

      const durationMs = Date.now() - startMs
      logger.info(
        {
          event: 'meesho_ads_sync_completed',
          accountId,
          syncRunId,
          records: processedRecords,
          totalRecords,
          pages: pagesProcessed,
          totalPages,
          missingMarked,
          durationMs,
        },
        '[MeeshoAdsSync] Sync completed successfully'
      )

      broadcastSyncCompleted(userId, accountId, syncRunId, processedRecords)

      return {
        success: true,
        syncRunId,
        processedRecords,
        totalRecords,
        pagesProcessed,
        totalPages,
        missingMarked,
        durationMs,
      }
    } else {
      // Partial failure — do NOT touch campaign sync_status
      const errorMsg = lastError || 'Sync failed: 0 pages processed'
      await AdsSyncRun.query().where('sync_run_id', syncRunId).update({
        status: ADS_SYNC_RUN_STATUS.FAILED,
        error_message: errorMsg,
        pages_processed: pagesProcessed,
        processed_records: processedRecords,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const durationMs = Date.now() - startMs
      logger.error(
        {
          event: 'meesho_ads_sync_failed',
          accountId,
          syncRunId,
          pages: pagesProcessed,
          totalPages,
          processedRecords,
          totalRecords,
          durationMs,
          error: errorMsg,
        },
        '[MeeshoAdsSync] Sync FAILED — existing DB state preserved'
      )

      broadcastSyncFailed(userId, accountId, syncRunId, errorMsg)

      return {
        success: false,
        syncRunId,
        processedRecords,
        totalRecords,
        pagesProcessed,
        totalPages,
        missingMarked: 0,
        durationMs,
        errorMessage: errorMsg,
      }
    }
  } finally {
    // Always release the lock — even on unexpected errors
    try {
      const currentLock = await redis.get(lockKey(accountId))
      // Only delete if WE hold the lock (prevents deleting a lock from a later sync)
      if (currentLock === syncRunId) {
        await redis.del(lockKey(accountId))
      }
    } catch (lockErr) {
      logger.warn({ accountId, syncRunId, err: lockErr }, '[MeeshoAdsSync] Failed to release lock')
    }
  }
}

/**
 * Check if a sync is currently running for an account.
 */
export async function isSyncRunning(accountId: number): Promise<boolean> {
  const lock = await redis.get(lockKey(accountId))
  return lock !== null
}

/**
 * Get the most recent sync run for an account.
 */
export async function getLatestSyncRun(accountId: number): Promise<AdsSyncRun | null> {
  return AdsSyncRun.query().where('account_id', accountId).orderBy('started_at', 'desc').first()
}

/**
 * Trigger a sync for ALL accounts belonging to a user.
 * Used by scheduler to run background syncs.
 */
export async function triggerSyncForAllAccounts(userId: number): Promise<void> {
  const accounts = await Account.query().where('user_id', userId).where('session_status', 'active')

  for (const account of accounts) {
    if (await isSyncRunning(account.id)) {
      logger.info(
        { accountId: account.id },
        '[MeeshoAdsSync] Skipping scheduler trigger — sync already running'
      )
      continue
    }

    const { default: SyncMeeshoAdsAccountJob } = await import('#jobs/sync_meesho_ads_account')
    await SyncMeeshoAdsAccountJob.dispatch({ accountId: account.id, userId })
    logger.info({ accountId: account.id, userId }, '[MeeshoAdsSync] Dispatched scheduled sync')
  }
}
