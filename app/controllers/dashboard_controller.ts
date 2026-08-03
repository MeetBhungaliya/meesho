import Account from '#models/account'
import { REDIS_KEYS } from '#services/external_api/constants'
import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

export default class DashboardController {
  async getStats({ auth, response }: HttpContext) {
    const user = await auth.authenticate()
    const accounts = await Account.query().where('user_id', user.id)

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
