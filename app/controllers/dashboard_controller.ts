import Account from '#models/account'
import { REDIS_KEYS } from '#services/external_api/constants'
import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

export default class DashboardController {
  async getStats({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const { accountIds } = request.qs()

    let accountsQuery = Account.query().where('user_id', user.id)

    if (accountIds !== undefined) {
      const ids = Array.isArray(accountIds)
        ? accountIds
        : typeof accountIds === 'string'
          ? accountIds.split(',').filter(Boolean)
          : [accountIds]
      if (ids.length === 0) {
        return response.ok({
          message: 'Dashboard stats fetched successfully',
          data: {
            acceptedOrdersToday: 0,
          },
        })
      }
      accountsQuery = accountsQuery.whereIn('id', ids)
    }

    const accounts = await accountsQuery

    let totalAcceptedOrdersToday = 0
    const dateKey = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd')

    for (const account of accounts) {
      const accountCountKey = REDIS_KEYS.accountOrders(account.id.toString(), dateKey)
      const count = Number(await redis.get(accountCountKey)) || 0
      totalAcceptedOrdersToday += count
    }

    return response.ok({
      message: 'Dashboard stats fetched successfully',
      data: {
        acceptedOrdersToday: totalAcceptedOrdersToday,
      },
    })
  }
}
