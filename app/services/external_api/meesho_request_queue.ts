type QueueTask<T> = () => Promise<T>

interface QueueItem<T> {
  task: QueueTask<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

/**
 * An in-memory queue that serializes and paces external requests to Meesho.
 * Prevents bursting traffic that triggers anti-bot / WAF 403 Forbidden rate limiters.
 */
export class MeeshoRequestQueue {
  private static queue: QueueItem<any>[] = []
  private static isProcessing = false
  private static inFlightMap = new Map<string, Promise<any>>()

  /** Minimum delay (in ms) between consecutive requests to Meesho */
  private static readonly INTER_REQUEST_DELAY_MS = 500

  /**
   * Enqueue a task to be executed sequentially with rate-limit pacing.
   */
  static enqueue<T>(task: QueueTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processNext()
    })
  }

  /**
   * Single-flight execution: if a task with the same dedupKey is already running,
   * reuse the pending promise instead of launching a duplicate request.
   */
  static async deduplicate<T>(dedupKey: string, task: QueueTask<T>): Promise<T> {
    const existing = this.inFlightMap.get(dedupKey)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = this.enqueue(task).finally(() => {
      this.inFlightMap.delete(dedupKey)
    })

    this.inFlightMap.set(dedupKey, promise)
    return promise
  }

  private static async processNext() {
    if (this.isProcessing) return
    if (this.queue.length === 0) return

    this.isProcessing = true
    const item = this.queue.shift()

    if (!item) {
      this.isProcessing = false
      return
    }

    try {
      const result = await item.task()
      item.resolve(result)
    } catch (error) {
      item.reject(error)
    } finally {
      // Respect polite inter-request delay before processing the next request in queue
      await this.sleep(this.INTER_REQUEST_DELAY_MS)
      this.isProcessing = false
      this.processNext()
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
