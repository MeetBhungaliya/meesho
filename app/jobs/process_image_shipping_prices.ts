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
  subSubCategoryId: number
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
    const { accountId, userId, subSubCategoryId, file } = this.payload
    const channel = `${userId}`

    try {
      const client = await MeeshoApiClient.forAccount(String(accountId))

      try {
        const s3Url = await globals.s3().getSignedUrl(file.path, { expiresIn: 300 })

        const s3Res = await fetch(s3Url)
        if (!s3Res.ok) throw new Error('Failed to fetch from S3')

        const blob = new Blob([await s3Res.arrayBuffer()], {
          type: this.getMimeType(file.clientName),
        })

        const formData = new FormData()
        formData.append('file', blob, file.clientName)

        const uploadRes = await client
          .post<{ image: string }>(MEESHO_ENDPOINTS.uploadSingleCatalogImages, formData)
          .catch((err) => console.error(err))

        const imageUrl = uploadRes?.data?.image
        if (!imageUrl) throw new Error('Image URL not returned from upload API')

        const priceRes = await client.post<{ data: { wu_shipping_charge: number } }>(
          MEESHO_ENDPOINTS.fetchDuplicatePid,
          { image_url: imageUrl, sscat_id: Number(subSubCategoryId) }
        )

        const wuShippingCharge = priceRes.data?.data?.wu_shipping_charge

        const shippingPrice = await ShippingPrice.findOrFail(file.shippingPriceId)
        shippingPrice.price = wuShippingCharge
        shippingPrice.meeshoImageUrl = imageUrl
        shippingPrice.isProcessed = true
        shippingPrice.errorMessage = null
        await shippingPrice.save()

        transmit.broadcast(channel, {
          event: 'success',
          name: file.clientName,
          wuShippingCharge,
        })
      } catch (error) {
        const message = (error as Error).message

        await ShippingPrice.query()
          .where('id', file.shippingPriceId)
          .update({ errorMessage: message, isProcessed: false })

        transmit.broadcast(channel, {
          event: 'failed',
          name: file.clientName,
          error: message,
        })
      }
    } catch (error) {
      const message = (error as Error).message

      await ShippingPrice.query()
        .where('id', file.shippingPriceId)
        .update({ errorMessage: message, isProcessed: false })
    }
  }

  async failed(error: Error) {
    const { userId } = this.payload
    logger.error(
      { userId, error: error.message },
      'ProcessImageShippingPrices job completely failed'
    )
  }
}
