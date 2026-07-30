import { HttpContext } from '@adonisjs/core/http'
import { MeeshoApiClient } from '#services/external_api/client'
import { ApiError, SessionError } from '#services/external_api/errors'

export default class ReturnOtpsController {
  async fetch({ request, response }: HttpContext) {
    const { accountIds } = request.only(['accountIds'])

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return response.badRequest({ message: 'accountIds array is required and cannot be empty' })
    }

    const results = await Promise.all(
      accountIds.map(async (accountId: string) => {
        try {
          const client = await MeeshoApiClient.forAccount(accountId)
          const supplier = client.supplier

          const payload = {
            supplier_id: supplier.supplierId,
            identifier: supplier.identifier,
          }

          const meeshoResponse = await client.post<any>(
            'https://supplier.meesho.com/api/fulfillment/returnRto/fetchDeliveryOTPs',
            payload
          )

          return {
            accountId,
            accountName: supplier.name,
            mobileNumber: supplier.phone,
            data: meeshoResponse.data,
            error: null,
          }
        } catch (error) {
          let errorMessage = 'Failed to fetch OTPs'
          if (error instanceof ApiError || error instanceof SessionError) {
            errorMessage = error.message
          } else if (error instanceof Error) {
            errorMessage = error.message
          }

          return {
            accountId,
            accountName: 'Unknown',
            mobileNumber: 'Unknown',
            data: null,
            error: errorMessage,
          }
        }
      })
    )

    return response.ok(results)
  }
}
