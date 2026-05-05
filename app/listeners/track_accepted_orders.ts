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
  }
}
