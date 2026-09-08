import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import transmit from '@adonisjs/transmit/services/main'
import { MeeshoApiClient } from '#services/external_api/client'
import { ApiError } from '#services/external_api/errors'
import { JobStateManager } from '#services/job_state_manager'

export interface FlexiGrowthOfferPayload {
  jobId: string
  accountId: string
  productIds: string[]
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  discountPercent: number
}

interface FailedItem {
  [key: string]: any
  productId: string
  reason: string
}

export default class FlexiGrowthOfferJob extends Job<FlexiGrowthOfferPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 1, // Let user retry manually instead of automatic retries hiding the failure
  }

  async execute() {
    const { jobId, accountId, productIds, start, end, discountPercent } = this.payload
    const channelName = `flexi-growth-offer:${jobId}`

    console.log(channelName)

    // Initialize persistent state in Redis
    await JobStateManager.initJob(channelName, productIds.length)

    transmit.broadcast(channelName, {
      type: 'started',
      total: productIds.length,
    })

    const client = await MeeshoApiClient.forAccount(accountId)
    const apiUrl = 'https://supplier.meesho.com/api/promotions/flexi-offers/supplier/bulk-add'

    let successCount = 0
    let failedCount = 0
    const failedItems: FailedItem[] = []

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i].trim()
      if (!productId) continue

      try {
        const payload = {
          product_ids: [productId],
          add: [
            {
              start,
              end,
              discount_percent: discountPercent,
            },
          ],
          remove: [],
        }

        await client.post(apiUrl, payload)

        successCount++

        // Persist to Redis
        await JobStateManager.updateProgress(channelName, {
          processed: i + 1,
          itemId: productId,
          status: 'success',
          itemType: 'productId',
        })

        transmit.broadcast(channelName, {
          type: 'progress',
          processed: i + 1,
          total: productIds.length,
          productId,
          status: 'success',
          successCount,
          failedCount,
        })
      } catch (error) {
        failedCount++
        const reason = error instanceof ApiError ? error.message : (error as Error).message
        failedItems.push({ productId, reason })

        // Persist to Redis
        await JobStateManager.updateProgress(channelName, {
          processed: i + 1,
          itemId: productId,
          status: 'failed',
          error: reason,
          itemType: 'productId',
        })

        transmit.broadcast(channelName, {
          type: 'progress',
          processed: i + 1,
          total: productIds.length,
          productId,
          status: 'failed',
          error: reason,
          successCount,
          failedCount,
        })
      }

      // Minor delay to avoid hitting rate limits on Meesho
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // Persist completion to Redis
    await JobStateManager.completeJob(channelName, { successCount, failedCount, failedItems })

    transmit.broadcast(channelName, {
      type: 'completed',
      successCount,
      failedCount,
      failedItems,
    })
  }

  async failed(error: Error) {
    const channelName = `flexi-growth-offer:${this.payload.jobId}`
    console.error('FlexiGrowthOffer failed:', error.message)

    await JobStateManager.errorJob(channelName, 'Job encountered an unrecoverable error: ' + error.message)

    transmit.broadcast(channelName, {
      type: 'error',
      message: 'Job encountered an unrecoverable error: ' + error.message,
    })
  }
}
