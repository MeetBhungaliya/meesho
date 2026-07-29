import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import FlexiGrowthOfferJob from '#jobs/flexi_growth_offer'

export default class FlexiGrowthOffersController {
  async submit({ request, response }: HttpContext) {
    const payload = request.only(['accountId', 'productIds', 'start', 'end', 'discountPercent', 'jobId'])
    const { accountId, productIds, start, end, discountPercent, jobId: clientJobId } = payload

    if (!accountId || !productIds || !start || !end || !discountPercent) {
      return response.badRequest({ message: 'Missing required fields' })
    }

    const parsedProductIds =
      typeof productIds === 'string'
        ? productIds
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : Array.isArray(productIds)
          ? productIds.map(String)
          : []

    if (parsedProductIds.length === 0) {
      return response.badRequest({ message: 'productIds cannot be empty' })
    }

    const jobId = clientJobId ? String(clientJobId) : randomUUID()

    await FlexiGrowthOfferJob.dispatch({
      jobId,
      accountId: String(accountId),
      productIds: parsedProductIds,
      start,
      end,
      discountPercent: Number(discountPercent),
    })

    return response.ok({
      message: 'Job queued successfully',
      jobId,
      total: parsedProductIds.length,
    })
  }

  async retry({ request, response }: HttpContext) {
    const payload = request.only(['accountId', 'productIds', 'start', 'end', 'discountPercent', 'jobId'])
    const { accountId, productIds, start, end, discountPercent, jobId: clientJobId } = payload

    if (!accountId || !productIds || !start || !end || !discountPercent) {
      return response.badRequest({ message: 'Missing required fields' })
    }

    const parsedProductIds = Array.isArray(productIds) ? productIds.map(String) : []

    if (parsedProductIds.length === 0) {
      return response.badRequest({ message: 'productIds cannot be empty for retry' })
    }

    const jobId = clientJobId ? String(clientJobId) : randomUUID()

    await FlexiGrowthOfferJob.dispatch({
      jobId,
      accountId: String(accountId),
      productIds: parsedProductIds,
      start,
      end,
      discountPercent: Number(discountPercent),
    })

    return response.ok({
      message: 'Retry job queued successfully',
      jobId,
      total: parsedProductIds.length,
    })
  }
}
