import type AcceptedOrders from '#events/accepted_orders'
import { DateTime } from 'luxon'
import transmit from '@adonisjs/transmit/services/main'
import { SessionManager } from '#services/external_api/session_manager'
import AccountModel from '#models/account'
import DashboardActivity from '#models/dashboard_activity'

export default class TrackAcceptedOrders {
  async handle(event: AcceptedOrders): Promise<void> {
    if (!event.ordersCount || event.ordersCount <= 0) {
      return
    }

    const userAccounts = await AccountModel.query().where('user_id', event.userId)

    // Prepare display details
    const supplierData = await SessionManager.getSupplierData(event.accountId)
    const targetAccount = userAccounts.find((a) => a.id.toString() === event.accountId)
    const accountDisplayName = supplierData?.name || targetAccount?.email || `#${event.accountId}`
    const actionText = 'Orders Auto-Accepted'
    const detailText = `${event.ordersCount} orders auto-accepted for ${accountDisplayName}`

    try {
      // Save recent activity to DB
      const activity = await DashboardActivity.create({
        userId: event.userId,
        action: actionText,
        detail: detailText,
        time: DateTime.now(),
        type: 'order',
        read: false,
      })

      // Storage Control: Delete user's activities older than 24 hours (86400 seconds)
      await DashboardActivity.query()
        .where('user_id', event.userId)
        .where('created_at', '<', DateTime.now().minus({ days: 1 }).toSQL())
        .delete()

      // Broadcast live activity with database activity id (omitting acceptedOrdersToday to fetch on demand)
      transmit.broadcast(`accounts/${event.userId}`, {
        type: 'activity',
        activity: {
          id: activity.id.toString(),
          action: activity.action,
          detail: activity.detail,
          time: activity.time.toISO(),
          type: activity.type,
          read: activity.read,
        },
      })
    } catch (dbError) {
      // Fallback: If DB insertion fails, broadcast directly so SSE still works, but log error
      console.error(
        'Database failed to persist dashboard activity; using memory fallback:',
        dbError
      )

      transmit.broadcast(`accounts/${event.userId}`, {
        type: 'activity',
        activity: {
          id: `fallback-${Date.now()}-${event.accountId}`,
          action: actionText,
          detail: detailText,
          time: new Date().toISOString(),
          type: 'order',
          read: false,
        },
      })
    }
  }
}
