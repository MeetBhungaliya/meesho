import Account from '#models/account'
import DashboardActivity from '#models/dashboard_activity'
import { MEESHO_ENDPOINTS } from '#services/external_api/constants'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { MeeshoApiClient } from '#services/external_api/client'

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

    // Query order counts from Meesho API concurrently without caching
    const counts = await Promise.all(
      accounts.map(async (account) => {
        try {
          const client = await MeeshoApiClient.forAccount(account.id.toString())
          const { data } = await client.post<{ total_count: number }>(MEESHO_ENDPOINTS.orders, {
            enable_hold: true,
            supplier_details: {
              id: client.supplier.supplierId,
              identifier: client.supplier.identifier,
              name: client.supplier.name,
            },
            limit: 1,
            status: 3,
            filter: {
              label_downloaded: {
                status: false,
              },
            },
            type: 'ready-to-ship',
            identifier: client.supplier.identifier,
          })
          return data.total_count || 0
        } catch (error) {
          return 0
        }
      })
    )

    const totalAcceptedOrdersToday = counts.reduce((sum, val) => sum + val, 0)

    return response.ok({
      message: 'Dashboard stats fetched successfully',
      data: {
        acceptedOrdersToday: totalAcceptedOrdersToday,
      },
    })
  }

  async getActivities({ auth, response }: HttpContext) {
    const user = await auth.authenticate()

    const activities = await DashboardActivity.query()
      .where('user_id', user.id)
      .where('created_at', '>=', DateTime.now().minus({ days: 1 }).toSQL())
      .orderBy('created_at', 'desc')

    return response.ok({
      message: 'Dashboard activities fetched successfully',
      data: activities,
    })
  }

  async markActivityRead({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    const activity = await DashboardActivity.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .firstOrFail()

    activity.read = true
    await activity.save()

    return response.ok({
      message: 'Activity marked as read successfully',
      data: activity,
    })
  }

  async deleteActivity({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    const activity = await DashboardActivity.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .firstOrFail()

    await activity.delete()

    return response.ok({
      message: 'Activity deleted successfully',
    })
  }

  async clearActivities({ auth, response }: HttpContext) {
    const user = await auth.authenticate()

    await DashboardActivity.query().where('user_id', user.id).delete()

    return response.ok({
      message: 'All activities cleared successfully',
    })
  }
}
