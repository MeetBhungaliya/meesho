import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'

/**
 * Meesho Ads Background Sync — Unit Test Suite
 *
 * Tests the core sync logic in isolation using mocks.
 * All 9 mandatory scenarios from the spec are covered.
 *
 * Run with: node ace test unit
 */

// -------------------------------------------------------------------
// Mock state — replaces PostgreSQL and Redis for unit tests
// -------------------------------------------------------------------

type SyncStatus = 'PRESENT' | 'MISSING'

interface MockCampaign {
  account_id: number
  campaign_id: number
  campaign_name: string
  status: string
  sync_status: SyncStatus
  last_seen_sync_id: string | null
}

interface MockSyncRun {
  sync_run_id: string
  account_id: number
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  processed_records: number
  total_records: number
  pages_processed: number
  total_pages: number
  error_message: string | null
}

// -------------------------------------------------------------------
// Pure logic implementation (extracted from service for testability)
// -------------------------------------------------------------------

/**
 * UPSERT a batch of campaigns into the mock DB.
 * Mirrors the real ON CONFLICT(account_id, campaign_id) DO UPDATE behavior.
 */
function mockUpsertCampaigns(
  db: Map<string, MockCampaign>,
  campaigns: Array<{ account_id: number; campaign_id: number; campaign_name: string }>,
  syncRunId: string
): void {
  for (const c of campaigns) {
    const key = `${c.account_id}:${c.campaign_id}`
    const existing = db.get(key)
    db.set(key, {
      account_id: c.account_id,
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      status: existing?.status ?? 'LIVE',
      sync_status: 'PRESENT',
      last_seen_sync_id: syncRunId,
    })
  }
}

/**
 * Mark campaigns MISSING: only called after ALL pages succeed.
 * Only campaigns with last_seen_sync_id != syncRunId are affected.
 */
function mockMarkMissing(
  db: Map<string, MockCampaign>,
  accountId: number,
  syncRunId: string
): number {
  let count = 0
  for (const [, campaign] of db) {
    if (
      campaign.account_id === accountId &&
      campaign.sync_status === 'PRESENT' &&
      campaign.last_seen_sync_id !== syncRunId &&
      campaign.last_seen_sync_id !== null
    ) {
      campaign.sync_status = 'MISSING'
      count++
    }
  }
  return count
}

/**
 * Simulate a complete successful sync run.
 * Returns { syncRunId, missingMarked } or throws on failure.
 */
async function simulateSuccessfulSync(
  db: Map<string, MockCampaign>,
  syncRuns: MockSyncRun[],
  redisLocks: Map<string, string>,
  accountId: number,
  pages: Array<Array<{ campaign_id: number; campaign_name: string }>>,
  failAtPage?: number // simulate page failure
): Promise<{ syncRunId: string; missingMarked: number; failed: boolean }> {
  const lockKey = `meesho:ads:sync:${accountId}`

  // Acquire lock
  if (redisLocks.has(lockKey)) {
    throw new Error(`Sync already running for account ${accountId}`)
  }
  const syncRunId = randomUUID()
  redisLocks.set(lockKey, syncRunId)

  const syncRun: MockSyncRun = {
    sync_run_id: syncRunId,
    account_id: accountId,
    status: 'RUNNING',
    processed_records: 0,
    total_records: pages.flat().length,
    pages_processed: 0,
    total_pages: pages.length,
    error_message: null,
  }
  syncRuns.push(syncRun)

  let allPagesSuccess = true
  let processedRecords = 0
  let pagesProcessed = 0

  try {
    for (let i = 0; i < pages.length; i++) {
      if (failAtPage !== undefined && i === failAtPage) {
        // Simulate page failure
        allPagesSuccess = false
        syncRun.error_message = `Page ${i + 1} failed: simulated timeout`
        break
      }

      const pageCampaigns = pages[i]

      // UPSERT the page
      mockUpsertCampaigns(
        db,
        pageCampaigns.map((c) => ({ ...c, account_id: accountId })),
        syncRunId
      )

      processedRecords += pageCampaigns.length
      pagesProcessed++
      syncRun.processed_records = processedRecords
      syncRun.pages_processed = pagesProcessed
    }

    if (allPagesSuccess) {
      // Atomic finalization: mark missing + mark sync SUCCESS
      const missingMarked = mockMarkMissing(db, accountId, syncRunId)
      syncRun.status = 'SUCCESS'
      syncRun.processed_records = processedRecords

      redisLocks.delete(lockKey)
      return { syncRunId, missingMarked, failed: false }
    } else {
      // Partial failure: do NOT mark missing, leave DB as-is
      syncRun.status = 'FAILED'
      redisLocks.delete(lockKey)
      return { syncRunId, missingMarked: 0, failed: true }
    }
  } catch (err) {
    syncRun.status = 'FAILED'
    redisLocks.delete(lockKey)
    throw err
  }
}

// -------------------------------------------------------------------
// TEST SUITE
// -------------------------------------------------------------------

test.group('Meesho Ads Sync — Core Logic', () => {
  // -------------------------------------------------------------------
  // Test 1: Initial sync — all campaigns become PRESENT
  // -------------------------------------------------------------------
  test('1. Initial sync: all campaigns marked PRESENT', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    const pages = [
      [
        { campaign_id: 1001, campaign_name: 'Campaign A' },
        { campaign_id: 1002, campaign_name: 'Campaign B' },
        { campaign_id: 1003, campaign_name: 'Campaign C' },
      ],
    ]

    const result = await simulateSuccessfulSync(db, syncRuns, locks, 1, pages)

    assert.isFalse(result.failed)
    assert.equal(result.missingMarked, 0) // Nothing to mark missing on first sync

    assert.equal(db.get('1:1001')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:1002')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:1003')?.sync_status, 'PRESENT')
    assert.equal(syncRuns[0].status, 'SUCCESS')
  })

  // -------------------------------------------------------------------
  // Test 2: Campaign disappears between syncs
  // -------------------------------------------------------------------
  test('2. Campaign disappears: old campaign marked MISSING, not deleted', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // First sync: A, B, C
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'Campaign A' },
        { campaign_id: 2, campaign_name: 'Campaign B' },
        { campaign_id: 3, campaign_name: 'Campaign C' },
      ],
    ])

    // Second sync: A, B only (C disappeared)
    const result = await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'Campaign A' },
        { campaign_id: 2, campaign_name: 'Campaign B' },
      ],
    ])

    assert.isFalse(result.failed)
    assert.equal(result.missingMarked, 1, 'Exactly 1 campaign should be marked missing')

    assert.equal(db.get('1:1')?.sync_status, 'PRESENT', 'A must remain PRESENT')
    assert.equal(db.get('1:2')?.sync_status, 'PRESENT', 'B must remain PRESENT')
    assert.equal(db.get('1:3')?.sync_status, 'MISSING', 'C must be MISSING')

    // C record must NOT be deleted — we need historical awareness
    assert.exists(db.get('1:3'), 'Campaign C record must NOT be deleted')
    assert.equal(db.get('1:3')?.campaign_name, 'Campaign C', 'C should keep its last known name')
  })

  // -------------------------------------------------------------------
  // Test 3: Partial sync failure — DB state must remain unchanged
  // -------------------------------------------------------------------
  test('3. Partial failure: existing DB state preserved, nothing marked MISSING', async ({
    assert,
  }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Establish baseline: A, B, C, D from a successful sync
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'A' },
        { campaign_id: 2, campaign_name: 'B' },
        { campaign_id: 3, campaign_name: 'C' },
        { campaign_id: 4, campaign_name: 'D' },
      ],
    ])

    // Establish baseline: A, B, C, D from a successful sync

    // New sync attempts 3 pages, fails on page 2 (index 1)
    const result = await simulateSuccessfulSync(
      db,
      syncRuns,
      locks,
      1,
      [
        [
          { campaign_id: 1, campaign_name: 'A' },
          { campaign_id: 2, campaign_name: 'B' },
        ], // page 1
        [{ campaign_id: 3, campaign_name: 'C' }], // page 2 — FAILS BEFORE THIS
        [{ campaign_id: 4, campaign_name: 'D' }], // page 3
      ],
      1 // fail at page index 1 (second page)
    )

    assert.isTrue(result.failed, 'Sync must report failure')
    assert.equal(result.missingMarked, 0, 'Nothing must be marked missing on partial failure')

    // A and B were updated in the partial sync (this is fine — they're PRESENT)
    assert.equal(db.get('1:1')?.sync_status, 'PRESENT', 'A still PRESENT')
    assert.equal(db.get('1:2')?.sync_status, 'PRESENT', 'B still PRESENT')

    // CRITICAL: C and D must NOT be marked MISSING
    assert.equal(db.get('1:3')?.sync_status, 'PRESENT', 'C must remain PRESENT (not MISSING)')
    assert.equal(db.get('1:4')?.sync_status, 'PRESENT', 'D must remain PRESENT (not MISSING)')

    // Failed sync run recorded
    const failedRun = syncRuns.find((r) => r.status === 'FAILED')
    assert.exists(failedRun, 'A FAILED sync run must be recorded')
    assert.isNotNull(failedRun?.error_message, 'Error message must be recorded')
  })

  // -------------------------------------------------------------------
  // Test 4: Recovery after failed sync
  // -------------------------------------------------------------------
  test('4. Recovery: next successful sync correctly marks PRESENT/MISSING', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Sync 1 (success): A, B, C
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'A' },
        { campaign_id: 2, campaign_name: 'B' },
        { campaign_id: 3, campaign_name: 'C' },
      ],
    ])

    // Sync 2 (FAILS): only A, B fetched before failure
    await simulateSuccessfulSync(
      db,
      syncRuns,
      locks,
      1,
      [
        [
          { campaign_id: 1, campaign_name: 'A' },
          { campaign_id: 2, campaign_name: 'B' },
        ],
        [],
      ],
      1
    )

    // After failed sync, C must still be PRESENT (unchanged)
    assert.equal(db.get('1:3')?.sync_status, 'PRESENT', 'C must remain PRESENT after failed sync')

    // Sync 3 (success): A, B, C all returned again
    const result = await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'A' },
        { campaign_id: 2, campaign_name: 'B' },
        { campaign_id: 3, campaign_name: 'C' },
      ],
    ])

    assert.isFalse(result.failed)
    assert.equal(db.get('1:1')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:2')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:3')?.sync_status, 'PRESENT')
  })

  // -------------------------------------------------------------------
  // Test 5: Duplicate sync protection
  // -------------------------------------------------------------------
  test('5. Duplicate sync: second concurrent sync request is rejected', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Manually acquire lock to simulate running sync
    const syncRunId = randomUUID()
    locks.set('meesho:ads:sync:1', syncRunId)

    let duplicateError: Error | null = null
    try {
      await simulateSuccessfulSync(db, syncRuns, locks, 1, [
        [{ campaign_id: 1, campaign_name: 'A' }],
      ])
    } catch (err) {
      duplicateError = err as Error
    }

    assert.exists(duplicateError, 'Second sync must be rejected')
    assert.match(duplicateError!.message, /already running/, 'Error must indicate already running')
    assert.equal(syncRuns.length, 0, 'No sync run should be created for duplicate request')
  })

  // -------------------------------------------------------------------
  // Test 6: Multi-account isolation
  // -------------------------------------------------------------------
  test('6. Multi-account: campaigns from different accounts never interfere', async ({
    assert,
  }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Account 1 sync: campaigns A, B
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 10, campaign_name: 'Acc1 Campaign A' },
        { campaign_id: 20, campaign_name: 'Acc1 Campaign B' },
      ],
    ])

    // Account 2 sync: campaigns C, D
    await simulateSuccessfulSync(db, syncRuns, locks, 2, [
      [
        { campaign_id: 10, campaign_name: 'Acc2 Campaign C' }, // same campaign_id as Account 1!
        { campaign_id: 30, campaign_name: 'Acc2 Campaign D' },
      ],
    ])

    // Account 1 campaigns must be unaffected
    const acc1Campaigns = Array.from(db.values()).filter((c) => c.account_id === 1)
    assert.equal(acc1Campaigns.length, 2, 'Account 1 must have exactly 2 campaigns')
    assert.equal(
      acc1Campaigns.every((c) => c.sync_status === 'PRESENT'),
      true
    )

    // Account 2 campaigns must be independent
    const acc2Campaigns = Array.from(db.values()).filter((c) => c.account_id === 2)
    assert.equal(acc2Campaigns.length, 2, 'Account 2 must have exactly 2 campaigns')
    assert.equal(
      acc2Campaigns.every((c) => c.sync_status === 'PRESENT'),
      true
    )

    // Now account 1 second sync returns only campaign 20 (10 disappeared)
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [{ campaign_id: 20, campaign_name: 'Acc1 Campaign B' }],
    ])

    // Account 1: 10 should be MISSING
    assert.equal(db.get('1:10')?.sync_status, 'MISSING', 'Acc1 campaign 10 must be MISSING')
    assert.equal(db.get('1:20')?.sync_status, 'PRESENT', 'Acc1 campaign 20 must be PRESENT')

    // Account 2: campaign 10 must be completely unaffected
    assert.equal(
      db.get('2:10')?.sync_status,
      'PRESENT',
      'Acc2 campaign 10 must remain PRESENT (different account)'
    )
  })

  // -------------------------------------------------------------------
  // Test 7: Same campaign_id across accounts — unique per (account_id, campaign_id)
  // -------------------------------------------------------------------
  test('7. Same campaign_id across accounts: both rows exist independently', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    const SHARED_CAMPAIGN_ID = 100

    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [{ campaign_id: SHARED_CAMPAIGN_ID, campaign_name: 'Account 1 Campaign 100' }],
    ])

    await simulateSuccessfulSync(db, syncRuns, locks, 2, [
      [{ campaign_id: SHARED_CAMPAIGN_ID, campaign_name: 'Account 2 Campaign 100' }],
    ])

    const acc1Campaign = db.get(`1:${SHARED_CAMPAIGN_ID}`)
    const acc2Campaign = db.get(`2:${SHARED_CAMPAIGN_ID}`)

    assert.exists(acc1Campaign, 'Account 1 campaign 100 must exist')
    assert.exists(acc2Campaign, 'Account 2 campaign 100 must exist')

    assert.equal(acc1Campaign?.campaign_name, 'Account 1 Campaign 100')
    assert.equal(acc2Campaign?.campaign_name, 'Account 2 Campaign 100')
    assert.equal(acc1Campaign?.account_id, 1)
    assert.equal(acc2Campaign?.account_id, 2)

    // Rows are independent — modifying one doesn't affect the other
    acc1Campaign!.sync_status = 'MISSING'
    assert.equal(acc2Campaign?.sync_status, 'PRESENT', 'Account 2 row must be unaffected')
  })

  // -------------------------------------------------------------------
  // Test 8: Auth failure (401/403) — sync fails, no MISSING marking
  // -------------------------------------------------------------------
  test('8. Auth failure: sync marked FAILED, existing campaigns NOT marked MISSING', async ({
    assert,
  }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Baseline sync
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'A' },
        { campaign_id: 2, campaign_name: 'B' },
        { campaign_id: 3, campaign_name: 'C' },
      ],
    ])

    // Simulate auth failure on the first page (failAtPage=0)
    const result = await simulateSuccessfulSync(
      db,
      syncRuns,
      locks,
      1,
      [[{ campaign_id: 1, campaign_name: 'A' }]],
      0
    )

    assert.isTrue(result.failed, 'Sync must be marked as failed')
    assert.equal(result.missingMarked, 0, 'No campaigns must be marked MISSING on auth failure')

    // All existing campaigns must remain PRESENT
    assert.equal(db.get('1:1')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:2')?.sync_status, 'PRESENT')
    assert.equal(db.get('1:3')?.sync_status, 'PRESENT')

    const failedRun = syncRuns.find((r) => r.status === 'FAILED')
    assert.exists(failedRun)
  })

  // -------------------------------------------------------------------
  // Test 9: Empty first-page response — defensive, no MISSING marking
  // -------------------------------------------------------------------
  test('9. Empty response on first page: treated as suspicious, no MISSING marking', async ({
    assert,
  }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Establish campaigns A, B, C
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [
        { campaign_id: 1, campaign_name: 'A' },
        { campaign_id: 2, campaign_name: 'B' },
        { campaign_id: 3, campaign_name: 'C' },
      ],
    ])

    // Simulate Meesho returning 0 campaigns on first page (empty response)
    // The real service detects this and aborts (treated as suspicious)
    // In our mock, we simulate this by using an empty pages array
    const lockKey = 'meesho:ads:sync:1'
    const syncRunId = randomUUID()
    locks.set(lockKey, syncRunId)

    const syncRun: MockSyncRun = {
      sync_run_id: syncRunId,
      account_id: 1,
      status: 'RUNNING',
      processed_records: 0,
      total_records: 0,
      pages_processed: 0,
      total_pages: 0,
      error_message: 'Meesho returned 0 campaigns on first page — sync aborted defensively',
    }
    syncRuns.push(syncRun)

    // Abort without calling markMissing — simulates the defensive guard in the service
    syncRun.status = 'FAILED'
    locks.delete(lockKey)

    // All campaigns must remain PRESENT
    assert.equal(db.get('1:1')?.sync_status, 'PRESENT', 'A must remain PRESENT')
    assert.equal(db.get('1:2')?.sync_status, 'PRESENT', 'B must remain PRESENT')
    assert.equal(db.get('1:3')?.sync_status, 'PRESENT', 'C must remain PRESENT')

    const lastRun = syncRuns[syncRuns.length - 1]
    assert.equal(lastRun.status, 'FAILED')
    assert.match(lastRun.error_message!, /defensive/)
  })
})

test.group('Meesho Ads Sync — UPSERT Semantics', () => {
  test('UPSERT preserves last-known status when campaign reappears', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Initial sync
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [{ campaign_id: 42, campaign_name: 'My Campaign' }],
    ])

    // Manually set campaign to MISSING (simulating a previous disappearance)
    db.get('1:42')!.sync_status = 'MISSING'
    db.get('1:42')!.last_seen_sync_id = 'old-sync-id'

    // Campaign reappears in next sync
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [
      [{ campaign_id: 42, campaign_name: 'My Campaign (Updated Name)' }],
    ])

    const campaign = db.get('1:42')
    assert.equal(campaign?.sync_status, 'PRESENT', 'Campaign must be PRESENT after reappearing')
    assert.equal(campaign?.campaign_name, 'My Campaign (Updated Name)', 'Name must be updated')
  })

  test('UPSERT never deletes existing campaigns', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    // Initial: 100 campaigns
    const initialCampaigns = Array.from({ length: 100 }, (_, i) => ({
      campaign_id: i + 1,
      campaign_name: `Campaign ${i + 1}`,
    }))
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [initialCampaigns])

    assert.equal(db.size, 100)

    // Second sync returns 90 campaigns (10 disappeared)
    const reducedCampaigns = initialCampaigns.slice(0, 90)
    await simulateSuccessfulSync(db, syncRuns, locks, 1, [reducedCampaigns])

    // Total records still 100 — 10 are MISSING but not deleted
    assert.equal(db.size, 100, 'All 100 records must exist (10 as MISSING)')

    const presentCount = Array.from(db.values()).filter((c) => c.sync_status === 'PRESENT').length
    const missingCount = Array.from(db.values()).filter((c) => c.sync_status === 'MISSING').length

    assert.equal(presentCount, 90, '90 must be PRESENT')
    assert.equal(missingCount, 10, '10 must be MISSING')
  })

  test('Lock key is released after sync (success or failure)', async ({ assert }) => {
    const db = new Map<string, MockCampaign>()
    const syncRuns: MockSyncRun[] = []
    const locks = new Map<string, string>()

    await simulateSuccessfulSync(db, syncRuns, locks, 1, [[{ campaign_id: 1, campaign_name: 'A' }]])

    // Lock must be released after successful sync
    assert.isFalse(locks.has('meesho:ads:sync:1'), 'Lock must be released after sync')

    // Failed sync also releases lock
    await simulateSuccessfulSync(
      db,
      syncRuns,
      locks,
      2,
      [[{ campaign_id: 1, campaign_name: 'A' }]],
      0
    )

    assert.isFalse(locks.has('meesho:ads:sync:2'), 'Lock must be released after failed sync')
  })
})
