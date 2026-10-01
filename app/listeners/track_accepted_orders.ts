import type AcceptedOrders from '#events/accepted_orders'
import DashboardActivity from '#models/dashboard_activity'
import Ws from '#services/ws'
import { DateTime } from 'luxon'

export default class TrackAcceptedOrders {
  async handle(event: AcceptedOrders): Promise<void> {
    // Skip creating an activity for 0-order events
    if (event.ordersCount <= 0) return

    // Persist activity to DB so it survives page reloads
    const count = event.ordersCount
    const label = count === 1 ? '1 order' : `${count} orders`

    const activity = await DashboardActivity.create({
      userId: event.userId,
      action: 'Orders Auto-Accepted',
      detail: `${label} auto-accepted successfully`,
      type: 'order',
      read: false,
      time: DateTime.fromJSDate(event.acceptedAt),
    })

    // Broadcast over WebSocket so the dashboard updates in real-time
    // The dashboard listens on `accounts/:userId` for { type: 'activity', activity: ... }
    await Ws.broadcast(`accounts/${event.userId}`, {
      type: 'activity',
      activity: activity.serialize(),
    })
  }
}
