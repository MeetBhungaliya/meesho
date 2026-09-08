import redis from '@adonisjs/redis/services/main'

/**
 * JobStateManager — Redis-backed persistent job state store.
 *
 * Stores cumulative job progress in Redis hashes so that:
 * 1. Clients can fetch current state on page reload / late join
 * 2. Progress is authoritative (no client-side incrementing)
 * 3. Multiple users can query the same job state
 *
 * Key format: `job:{channelName}` with a 2-hour TTL.
 */

export interface PersistedJobState {
  channelName: string
  status: 'started' | 'progress' | 'completed' | 'error'
  total: number
  processed: number
  successCount: number
  failedCount: number
  failedItems: Array<{ productId?: string; catalogId?: string; reason: string }>
  errorMessage: string
  logs: Array<{ type: 'success' | 'error' | 'info'; message: string; timestamp: number }>
  startedAt: number
  updatedAt: number
}

const JOB_KEY_PREFIX = 'job:'
const JOB_TTL_SECONDS = 2 * 60 * 60 // 2 hours
const ACTIVE_JOBS_SET = 'active_jobs'

export class JobStateManager {
  /**
   * Initialize a new job in Redis when it starts.
   */
  static async initJob(channelName: string, total: number): Promise<void> {
    const now = Date.now()
    const state: PersistedJobState = {
      channelName,
      status: 'started',
      total,
      processed: 0,
      successCount: 0,
      failedCount: 0,
      failedItems: [],
      errorMessage: '',
      logs: [{ type: 'info', message: `Job started. Processing ${total} items...`, timestamp: now }],
      startedAt: now,
      updatedAt: now,
    }

    const key = `${JOB_KEY_PREFIX}${channelName}`
    await redis.set(key, JSON.stringify(state), 'EX', JOB_TTL_SECONDS)
    await redis.sadd(ACTIVE_JOBS_SET, channelName)
  }

  /**
   * Update progress for a single item processed.
   */
  static async updateProgress(
    channelName: string,
    data: {
      processed: number
      itemId: string
      status: 'success' | 'failed'
      error?: string
      itemType: 'productId' | 'catalogId'
    }
  ): Promise<void> {
    const key = `${JOB_KEY_PREFIX}${channelName}`
    const raw = await redis.get(key)
    if (!raw) return

    const state: PersistedJobState = JSON.parse(raw)
    const now = Date.now()

    state.status = 'progress'
    state.processed = Math.max(state.processed, data.processed)
    state.updatedAt = now

    if (data.status === 'success') {
      state.successCount++
      state.logs.push({
        type: 'success',
        message: `Successfully processed ${data.itemId}`,
        timestamp: now,
      })
    } else if (data.status === 'failed') {
      state.failedCount++
      state.logs.push({
        type: 'error',
        message: `Failed to process ${data.itemId}: ${data.error}`,
        timestamp: now,
      })
      state.failedItems.push({
        [data.itemType]: data.itemId,
        reason: data.error || 'Unknown error',
      } as any)
    }

    await redis.set(key, JSON.stringify(state), 'EX', JOB_TTL_SECONDS)
  }

  /**
   * Mark a job as completed.
   */
  static async completeJob(
    channelName: string,
    data: {
      successCount: number
      failedCount: number
      failedItems: any[]
    }
  ): Promise<void> {
    const key = `${JOB_KEY_PREFIX}${channelName}`
    const raw = await redis.get(key)
    if (!raw) return

    const state: PersistedJobState = JSON.parse(raw)
    const now = Date.now()

    state.status = 'completed'
    state.successCount = data.successCount
    state.failedCount = data.failedCount
    state.failedItems = data.failedItems
    state.processed = state.total // ensure 100%
    state.updatedAt = now
    state.logs.push({ type: 'info', message: 'Job completed.', timestamp: now })

    await redis.set(key, JSON.stringify(state), 'EX', JOB_TTL_SECONDS)
    await redis.srem(ACTIVE_JOBS_SET, channelName)
  }

  /**
   * Mark a job as errored.
   */
  static async errorJob(channelName: string, errorMessage: string): Promise<void> {
    const key = `${JOB_KEY_PREFIX}${channelName}`
    const raw = await redis.get(key)
    if (!raw) return

    const state: PersistedJobState = JSON.parse(raw)
    const now = Date.now()

    state.status = 'error'
    state.errorMessage = errorMessage
    state.updatedAt = now
    state.logs.push({ type: 'error', message: `Fatal error: ${errorMessage}`, timestamp: now })

    await redis.set(key, JSON.stringify(state), 'EX', JOB_TTL_SECONDS)
    await redis.srem(ACTIVE_JOBS_SET, channelName)
  }

  /**
   * Get the current state of a specific job.
   */
  static async getJobState(channelName: string): Promise<PersistedJobState | null> {
    const key = `${JOB_KEY_PREFIX}${channelName}`
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as PersistedJobState
  }

  /**
   * Get all active jobs, optionally filtered by type prefix.
   * @param typePrefix - e.g. 'flexi-growth-offer' or 'ad-launch'
   */
  static async getActiveJobs(typePrefix?: string): Promise<PersistedJobState[]> {
    const channelNames = await redis.smembers(ACTIVE_JOBS_SET)
    if (channelNames.length === 0) return []

    const filtered = typePrefix
      ? channelNames.filter((name) => name.startsWith(typePrefix))
      : channelNames

    const results: PersistedJobState[] = []
    for (const name of filtered) {
      const state = await this.getJobState(name)
      if (state) {
        // If the job is still in active set but actually completed/errored, clean up
        if (state.status === 'completed' || state.status === 'error') {
          await redis.srem(ACTIVE_JOBS_SET, name)
        } else {
          results.push(state)
        }
      } else {
        // Key expired but still in set, clean up
        await redis.srem(ACTIVE_JOBS_SET, name)
      }
    }

    return results
  }
}
