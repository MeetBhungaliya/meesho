import { REDIS_KEYS, REDIS_TTL } from '#services/external_api/constants'
import type AcceptedOrders from '#events/accepted_orders'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

export default class TrackAcceptedOrders {
  async handle(event: AcceptedOrders): Promise<void> {
    const dateKey = DateTime.fromJSDate(event.acceptedAt)
      .setZone('Asia/Kolkata')
      .toFormat('yyyy-MM-dd')

    const accountCountKey = REDIS_KEYS.accountOrders(event.accountId, dateKey)

    await redis.incrby(accountCountKey, event.ordersCount)
    await redis.expire(accountCountKey, REDIS_TTL.ORDER_TRACKING)

    // Calculate daily total for user across all accounts
    const AccountModel = (await import('#models/account')).default
    const userAccounts = await AccountModel.query().where('user_id', event.userId)
    let totalAcceptedOrdersToday = 0
    for (const acc of userAccounts) {
      const accKey = REDIS_KEYS.accountOrders(acc.id.toString(), dateKey)
      totalAcceptedOrdersToday += Number(await redis.get(accKey)) || 0
    }

    const transmit = (await import('@adonisjs/transmit/services/main')).default
    
    // Broadcast live activity and updated total
    transmit.broadcast(`accounts/${event.userId}`, {
      type: 'activity',
      activity: {
        id: `activity-${Date.now()}-${event.accountId}`,
        action: 'Orders Auto-Accepted',
        detail: `${event.ordersCount} orders auto-accepted for account #${event.accountId}`,
        time: new Date().toISOString(),
        type: 'order',
      },
      acceptedOrdersToday: totalAcceptedOrdersToday,
    })
  }
}
