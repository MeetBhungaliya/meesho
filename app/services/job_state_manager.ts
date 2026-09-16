import redis from '@adonisjs/redis/services/main'

/**
 * Counters live in a Redis hash. HINCRBY is atomic, so overlapping writes
 * cannot lose counts. Detail lists are bounded so long jobs stay inexpensive.
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
const JOB_TTL_SECONDS = 2 * 60 * 60
const ACTIVE_JOBS_SET = 'active_jobs'
const MAX_LOGS = 100
const MAX_FAILED_ITEMS = 250
const STALE_JOB_MS = 10 * 60 * 1000
const numberValue = (value: string | undefined) => Number(value || 0)

export class JobStateManager {
  private static knownHashKeys = new Set<string>()
  private static key(channelName: string) {
    return `${JOB_KEY_PREFIX}${channelName}`
  }
  private static logsKey(channelName: string) {
    return `${this.key(channelName)}:logs`
  }
  private static failedItemsKey(channelName: string) {
    return `${this.key(channelName)}:failed-items`
  }

  static async initJob(channelName: string, total: number): Promise<void> {
    const now = Date.now()
    const key = this.key(channelName)
    const pipeline = redis.multi()
    pipeline.del(key, this.logsKey(channelName), this.failedItemsKey(channelName))
    pipeline.hset(
      key,
      'channelName',
      channelName,
      'status',
      'started',
      'total',
      String(total),
      'processed',
      '0',
      'successCount',
      '0',
      'failedCount',
      '0',
      'errorMessage',
      '',
      'startedAt',
      String(now),
      'updatedAt',
      String(now)
    )
    pipeline.rpush(
      this.logsKey(channelName),
      JSON.stringify({
        type: 'info',
        message: `Job started. Processing ${total} items...`,
        timestamp: now,
      })
    )
    pipeline.expire(key, JOB_TTL_SECONDS)
    pipeline.expire(this.logsKey(channelName), JOB_TTL_SECONDS)
    pipeline.expire(this.failedItemsKey(channelName), JOB_TTL_SECONDS)
    pipeline.sadd(ACTIVE_JOBS_SET, channelName)
    await pipeline.exec()
    this.knownHashKeys.add(key)
  }

  /** Safely converts an in-flight deployment's old JSON state on first touch. */
  private static async ensureHash(channelName: string): Promise<void> {
    const key = this.key(channelName)
    if (this.knownHashKeys.has(key)) return
    const type = await redis.type(key)
    if (type === 'string') {
      const raw = await redis.get(key)
      if (raw) {
        try {
          const state = JSON.parse(raw) as PersistedJobState
          const ttl = await redis.ttl(key)
          const expiresIn = ttl > 0 ? ttl : JOB_TTL_SECONDS
          const pipeline = redis.multi()
          pipeline.del(key, this.logsKey(channelName), this.failedItemsKey(channelName))
          pipeline.hset(
            key,
            'channelName',
            state.channelName || channelName,
            'status',
            state.status,
            'total',
            String(state.total),
            'processed',
            String(state.processed),
            'successCount',
            String(state.successCount),
            'failedCount',
            String(state.failedCount),
            'errorMessage',
            state.errorMessage || '',
            'startedAt',
            String(state.startedAt),
            'updatedAt',
            String(state.updatedAt)
          )
          if (state.logs.length)
            pipeline.rpush(
              this.logsKey(channelName),
              ...state.logs.slice(-MAX_LOGS).map((entry) => JSON.stringify(entry))
            )
          if (state.failedItems.length)
            pipeline.rpush(
              this.failedItemsKey(channelName),
              ...state.failedItems.slice(-MAX_FAILED_ITEMS).map((entry) => JSON.stringify(entry))
            )
          pipeline.expire(key, expiresIn)
          pipeline.expire(this.logsKey(channelName), expiresIn)
          pipeline.expire(this.failedItemsKey(channelName), expiresIn)
          await pipeline.exec()
        } catch {
          // A corrupt progress key is treated as missing; the worker will mark its job failed normally.
        }
      }
    }
    this.knownHashKeys.add(key)
  }

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
    await this.ensureHash(channelName)
    const key = this.key(channelName)
    const now = Date.now()
    const success = data.status === 'success'
    const pipeline = redis.multi()
    // The supplied loop index is deliberately not used: HINCRBY cannot lose a
    // count if requests overlap or a worker is restarted mid-update.
    pipeline.hincrby(key, 'processed', 1)
    pipeline.hincrby(key, success ? 'successCount' : 'failedCount', 1)
    pipeline.hset(key, 'status', 'progress', 'updatedAt', String(now))
    pipeline.rpush(
      this.logsKey(channelName),
      JSON.stringify({
        type: success ? 'success' : 'error',
        message: success
          ? `Successfully processed ${data.itemId}`
          : `Failed to process ${data.itemId}: ${data.error || 'Unknown error'}`,
        timestamp: now,
      })
    )
    pipeline.ltrim(this.logsKey(channelName), -MAX_LOGS, -1)
    if (!success) {
      pipeline.rpush(
        this.failedItemsKey(channelName),
        JSON.stringify({ [data.itemType]: data.itemId, reason: data.error || 'Unknown error' })
      )
      pipeline.ltrim(this.failedItemsKey(channelName), -MAX_FAILED_ITEMS, -1)
    }
    pipeline.expire(key, JOB_TTL_SECONDS)
    pipeline.expire(this.logsKey(channelName), JOB_TTL_SECONDS)
    pipeline.expire(this.failedItemsKey(channelName), JOB_TTL_SECONDS)
    await pipeline.exec()
  }

  static async completeJob(
    channelName: string,
    data: { successCount: number; failedCount: number; failedItems: any[] }
  ): Promise<void> {
    await this.ensureHash(channelName)
    const key = this.key(channelName)
    const total = await redis.hget(key, 'total')
    if (total === null) return
    const now = Date.now()
    const pipeline = redis.multi()
    pipeline.hset(
      key,
      'status',
      'completed',
      'processed',
      total,
      'successCount',
      String(data.successCount),
      'failedCount',
      String(data.failedCount),
      'updatedAt',
      String(now)
    )
    pipeline.rpush(
      this.logsKey(channelName),
      JSON.stringify({ type: 'info', message: 'Job completed.', timestamp: now })
    )
    pipeline.ltrim(this.logsKey(channelName), -MAX_LOGS, -1)
    pipeline.expire(key, JOB_TTL_SECONDS)
    pipeline.expire(this.logsKey(channelName), JOB_TTL_SECONDS)
    pipeline.srem(ACTIVE_JOBS_SET, channelName)
    await pipeline.exec()
  }

  static async errorJob(channelName: string, errorMessage: string): Promise<void> {
    await this.ensureHash(channelName)
    const key = this.key(channelName)
    if ((await redis.exists(key)) === 0) return
    const now = Date.now()
    const pipeline = redis.multi()
    pipeline.hset(key, 'status', 'error', 'errorMessage', errorMessage, 'updatedAt', String(now))
    pipeline.rpush(
      this.logsKey(channelName),
      JSON.stringify({ type: 'error', message: `Fatal error: ${errorMessage}`, timestamp: now })
    )
    pipeline.ltrim(this.logsKey(channelName), -MAX_LOGS, -1)
    pipeline.expire(key, JOB_TTL_SECONDS)
    pipeline.expire(this.logsKey(channelName), JOB_TTL_SECONDS)
    pipeline.srem(ACTIVE_JOBS_SET, channelName)
    await pipeline.exec()
  }

  static async getJobState(channelName: string): Promise<PersistedJobState | null> {
    const key = this.key(channelName)
    if (!this.knownHashKeys.has(key) && (await redis.type(key)) === 'string') {
      const raw = await redis.get(key)
      if (!raw) return null
      try {
        return JSON.parse(raw) as PersistedJobState
      } catch {
        return null
      }
    }
    const fields = await redis.hgetall(key)
    if (Object.keys(fields).length === 0) return null
    const [rawLogs, rawFailedItems] = await Promise.all([
      redis.lrange(this.logsKey(channelName), 0, -1),
      redis.lrange(this.failedItemsKey(channelName), 0, -1),
    ])
    const parse = <T>(items: string[]): T[] =>
      items.flatMap((item) => {
        try {
          return [JSON.parse(item) as T]
        } catch {
          return []
        }
      })
    return {
      channelName: fields.channelName || channelName,
      status: (fields.status || 'started') as PersistedJobState['status'],
      total: numberValue(fields.total),
      processed: numberValue(fields.processed),
      successCount: numberValue(fields.successCount),
      failedCount: numberValue(fields.failedCount),
      failedItems: parse(rawFailedItems),
      errorMessage: fields.errorMessage || '',
      logs: parse(rawLogs),
      startedAt: numberValue(fields.startedAt),
      updatedAt: numberValue(fields.updatedAt),
    }
  }

  static async getActiveJobs(typePrefix?: string): Promise<PersistedJobState[]> {
    const names = await redis.smembers(ACTIVE_JOBS_SET)
    const relevant = typePrefix ? names.filter((name) => name.startsWith(typePrefix)) : names
    const results: PersistedJobState[] = []
    for (const name of relevant) {
      const state = await this.getJobState(name)
      if (!state || state.status === 'completed' || state.status === 'error')
        await redis.srem(ACTIVE_JOBS_SET, name)
      else if (Date.now() - state.updatedAt > STALE_JOB_MS)
        await this.errorJob(
          name,
          'Job stopped reporting progress and was marked stale. Please retry it.'
        )
      else results.push(state)
    }
    return results
  }
}
