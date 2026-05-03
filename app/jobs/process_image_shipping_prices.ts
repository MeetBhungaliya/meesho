import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import transmit from '@adonisjs/transmit/services/main'
import { MeeshoApiClient } from '#services/external_api/client'
import logger from '@adonisjs/core/services/logger'
import { globals } from '#libs/globals'
import ShippingPrice from '#models/shipping_price'
import { MEESHO_ENDPOINTS } from '#services/external_api/constants'

interface ProcessImageShippingPricesPayload {
  accountId: number
  userId: number
  sub_sub_category_id: number
  file: { path: string; clientName: string; shippingPriceId: number }
}

export default class ProcessImageShippingPrices extends Job<ProcessImageShippingPricesPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 1,
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    return 'image/jpeg'
  }

  async execute() {
    const { accountId, userId, sub_sub_category_id, file } = this.payload
    const channel = `${userId}`

    try {
      const client = await MeeshoApiClient.forAccount(String(accountId))

      try {
        // 1. Fetch from S3 using signed URL
        const s3Url = await globals.s3().getSignedUrl(file.path, { expiresIn: 300 })

        const s3Res = await fetch(s3Url)
        if (!s3Res.ok) throw new Error('Failed to fetch from S3')

        const arrayBuffer = await s3Res.arrayBuffer()

        const blob = new Blob([arrayBuffer], {
          type: this.getMimeType(file.clientName),
        })

        const formData = new FormData()
        formData.append('file', blob, file.clientName)

        const uploadRes = await client.post<{ image: string }>(
          MEESHO_ENDPOINTS.uploadSingleCatalogImages,
          formData
        ).catch(err=> console.error(err))


        const imageUrl = uploadRes?.data?.image
        if (!imageUrl) {
          throw new Error('Image URL not returned from upload API')
        }

        // 3. Fetch duplicate PID and price recommendation
        const priceRes = await client.post<{ data: { wu_shipping_charge: number } }>(
          MEESHO_ENDPOINTS.fetchDuplicatePid,
          {
            image_url: imageUrl,
            sscat_id: sub_sub_category_id
          }
        )

        const wu_shipping_charge = priceRes.data?.data?.wu_shipping_charge

        // 4. Update the DB record
        const shippingPrice = await ShippingPrice.findOrFail(file.shippingPriceId)
        shippingPrice.prices = wu_shipping_charge
        await shippingPrice.save()

        // 5. Broadcast the final result directly
        transmit.broadcast(channel, {
          event: 'processing_step',
          name: file.clientName,
          progress: 'completed',
          shippingPriceId: file.shippingPriceId,
          url: imageUrl,
          wu_shipping_charge
        })

      } catch (error) {
        logger.error({ file: file.clientName, error: (error as Error).message }, 'Error processing individual file')
        transmit.broadcast(channel, {
          event: 'processing_error',
          name: file.clientName,
          error: (error as Error).message,
        })
      }

    } catch (error) {
      logger.error({ accountId, error: (error as Error).message }, 'Failed to initialize MeeshoApiClient for background job')
    }
  }

  async failed(error: Error) {
    const { userId } = this.payload
    logger.error({ userId, error: error.message }, 'ProcessImageShippingPrices job completely failed')
  }
}