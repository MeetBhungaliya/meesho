import { REDIS_KEYS, REDIS_TTL } from '#services/external_api/constants'
import type AcceptedOrders from '#events/accepted_orders'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

export default class TrackAcceptedOrders {
  async handle(event: AcceptedOrders): Promise<void> {
    const dateKey = DateTime.fromJSDate(event.acceptedAt).toFormat('yyyy-MM-dd')

    const accountCountKey = REDIS_KEYS.accountOrders(event.accountId, dateKey)
    const userCountKey = REDIS_KEYS.userOrders(event.userId, dateKey)

    await redis.set(accountCountKey, event.ordersCount)
    await redis.incrby(userCountKey, event.ordersCount)

    await redis.expire(accountCountKey, REDIS_TTL.ORDER_TRACKING)
    await redis.expire(userCountKey, REDIS_TTL.ORDER_TRACKING)
  }
}
