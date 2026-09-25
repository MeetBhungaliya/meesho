import Account from '#models/account'
import DashboardActivity from '#models/dashboard_activity'
import { MEESHO_ENDPOINTS } from '#services/external_api/constants'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { MeeshoApiClient } from '#services/external_api/client'

export default class DashboardController {
  async getStats({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const { accountIds, label_downloaded } = request.qs()

    // Determine label_downloaded filter:
    // If not provided (or 'all'), do not pass filter object to get total count
    let isLabelDownloaded: boolean | undefined
    if (label_downloaded !== undefined && label_downloaded !== '' && label_downloaded !== 'all') {
      isLabelDownloaded =
        label_downloaded === true ||
        label_downloaded === 'true' ||
        label_downloaded === 'Yes' ||
        label_downloaded === '1'
    }

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
          const supplierDetails = {
            id: client.supplier.supplierId,
            identifier: client.supplier.identifier,
            name: client.supplier.name,
          }

          const acceptedOrderPayload: Record<string, unknown> = {
            enable_hold: true,
            supplier_details: supplierDetails,
            limit: 1,
            status: 3,
            type: 'ready-to-ship',
            identifier: client.supplier.identifier,
          }

          if (isLabelDownloaded !== undefined) {
            acceptedOrderPayload.filter = {
              label_downloaded: {
                status: isLabelDownloaded,
              },
            }
          }

          const holdOrderPayload: Record<string, unknown> = {
            enable_hold: true,
            supplier_details: supplierDetails,
            cursor: null,
            limit: 1,
            status: 0,
            type: 'hold',
            identifier: client.supplier.identifier,
            child_supplier_identifier: null,
            child_supplier_id: null,
          }

          const [acceptedRes, holdRes] = await Promise.all([
            client
              .post<{ total_count: number }>(MEESHO_ENDPOINTS.orders, acceptedOrderPayload)
              .catch(() => ({ data: { total_count: 0 } })),
            client
              .post<{ total_count: number }>(MEESHO_ENDPOINTS.orders, holdOrderPayload)
              .catch(() => ({ data: { total_count: 0 } })),
          ])

          return {
            accepted: acceptedRes.data?.total_count || 0,
            onHold: holdRes.data?.total_count || 0,
          }
        } catch (error) {
          return {
            accepted: 0,
            onHold: 0,
          }
        }
      })
    )

    const totalAcceptedOrdersToday = counts.reduce((sum, val) => sum + val.accepted, 0)
    const totalOnHoldOrders = counts.reduce((sum, val) => sum + val.onHold, 0)

    return response.ok({
      message: 'Dashboard stats fetched successfully',
      data: {
        acceptedOrdersToday: totalAcceptedOrdersToday,
        onHoldOrders: totalOnHoldOrders,
      },
    })
  }

  async getActivities({ auth, response }: HttpContext) {
    const user = await auth.authenticate()

    // Clean up any legacy 0-orders activity records for this user
    await DashboardActivity.query()
      .where('user_id', user.id)
      .where((query) => {
        query
          .where('detail', 'like', '0 orders%')
          .orWhere('detail', 'like', '0 order%')
          .orWhere('action', 'like', '0 orders%')
      })
      .delete()

    const activities = await DashboardActivity.query()
      .where('user_id', user.id)
      .where('created_at', '>=', DateTime.now().minus({ days: 1 }).toSQL())
      .whereNot('detail', 'like', '0 orders%')
      .whereNot('detail', 'like', '0 order%')
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

  async getPayments({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const { accountIds, status = 'pending' } = request.qs()

    let accountsQuery = Account.query().where('user_id', user.id)

    if (accountIds !== undefined) {
      const ids = Array.isArray(accountIds)
        ? accountIds
        : typeof accountIds === 'string'
          ? accountIds.split(',').filter(Boolean)
          : [accountIds]
      if (ids.length === 0) {
        return response.ok({
          message: 'Payments fetched successfully',
          data: {
            daywisePayments: [],
            header: {
              headerAmount: '₹0',
              netAmount: 0,
              netOrderAmount: 0,
              netPlatformRecovery: {
                adsCost: 0,
                programCosts: 0,
                loanSettlementAmount: 0,
              },
              netPlatformCompensation: {
                referralAmount: 0,
                programBenefits: 0,
              },
              platformCompensation: 0,
              platformRecovery: 0,
            },
            count: 0,
            accountBreakdown: [],
          },
        })
      }
      accountsQuery = accountsQuery.whereIn('id', ids)
    }

    const accounts = await accountsQuery

    const results = await Promise.all(
      accounts.map(async (account) => {
        try {
          const client = await MeeshoApiClient.forAccount(account.id.toString())
          const supplierId = client.supplier.supplierId
          const identifier = client.supplier.identifier

          const payload = {
            supplier_id: supplierId,
            identifier,
            status,
          }

          const res = await client.post<{
            daywisePayments?: any[]
            header?: any
            count?: number
            updatedAtTimestamp?: string
          }>(MEESHO_ENDPOINTS.allPayments, payload)

          return {
            account: {
              id: account.id,
              name: client.supplier.name || account.email,
              identifier,
            },
            data: res.data,
            error: null,
          }
        } catch (error: any) {
          return {
            account: {
              id: account.id,
              name: account.email,
              identifier: '',
            },
            data: null,
            error: error.message || 'Failed to fetch payments',
          }
        }
      })
    )

    // Aggregate across selected accounts
    const daywiseMap = new Map<string, any>()
    let totalNetAmount = 0
    let totalNetOrderAmount = 0
    let totalAdsCost = 0
    let totalProgramCosts = 0
    let totalLoanSettlementAmount = 0
    let totalReferralAmount = 0
    let totalProgramBenefits = 0
    let totalPlatformCompensation = 0
    let totalPlatformRecovery = 0
    let latestUpdatedAt: string | null = null

    for (const r of results) {
      if (!r.data) continue
      const { daywisePayments, header, updatedAtTimestamp } = r.data
      if (updatedAtTimestamp && (!latestUpdatedAt || updatedAtTimestamp > latestUpdatedAt)) {
        latestUpdatedAt = updatedAtTimestamp
      }

      if (header) {
        totalNetAmount += Number(header.netAmount || 0)
        totalNetOrderAmount += Number(header.netOrderAmount || 0)
        totalAdsCost += Number(header.netPlatformRecovery?.adsCost || 0)
        totalProgramCosts += Number(header.netPlatformRecovery?.programCosts || 0)
        totalLoanSettlementAmount += Number(header.netPlatformRecovery?.loanSettlementAmount || 0)
        totalReferralAmount += Number(header.netPlatformCompensation?.referralAmount || 0)
        totalProgramBenefits += Number(header.netPlatformCompensation?.programBenefits || 0)
        totalPlatformCompensation += Number(header.platformCompensation || 0)
        totalPlatformRecovery += Number(header.platformRecovery || 0)
      }

      if (Array.isArray(daywisePayments)) {
        for (const day of daywisePayments) {
          const dateKey = day.date
          if (!daywiseMap.has(dateKey)) {
            daywiseMap.set(dateKey, {
              date: day.date,
              date_iso: day.date_iso,
              netAmount: 0,
              netOrderAmount: 0,
              netPlatformRecovery: {
                adsCost: 0,
                programCosts: 0,
                loanSettlementAmount: 0,
                loanSettlementStatus:
                  day.netPlatformRecovery?.loanSettlementStatus || 'To be calculated',
              },
              netPlatformCompensation: {
                referralAmount: 0,
                programBenefits: 0,
              },
              platformCompensation: 0,
              platformRecovery: 0,
            })
          }
          const item = daywiseMap.get(dateKey)
          item.netAmount += Number(day.netAmount || 0)
          item.netOrderAmount += Number(day.netOrderAmount || 0)
          item.netPlatformRecovery.adsCost += Number(day.netPlatformRecovery?.adsCost || 0)
          item.netPlatformRecovery.programCosts += Number(
            day.netPlatformRecovery?.programCosts || 0
          )
          item.netPlatformRecovery.loanSettlementAmount += Number(
            day.netPlatformRecovery?.loanSettlementAmount || 0
          )
          item.netPlatformCompensation.referralAmount += Number(
            day.netPlatformCompensation?.referralAmount || 0
          )
          item.netPlatformCompensation.programBenefits += Number(
            day.netPlatformCompensation?.programBenefits || 0
          )
          item.platformCompensation += Number(day.platformCompensation || 0)
          item.platformRecovery += Number(day.platformRecovery || 0)
        }
      }
    }

    const aggregatedDaywise = Array.from(daywiseMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item) => ({
        ...item,
        headerAmount: `₹${(item.netAmount / 1000).toFixed(2)}K`,
      }))

    return response.ok({
      message: 'Payments fetched successfully',
      data: {
        daywisePayments: aggregatedDaywise,
        header: {
          headerAmount: `₹${(totalNetAmount / 1000).toFixed(2)}K`,
          netAmount: Math.round(totalNetAmount * 100) / 100,
          netOrderAmount: Math.round(totalNetOrderAmount * 100) / 100,
          netPlatformRecovery: {
            adsCost: Math.round(totalAdsCost * 100) / 100,
            programCosts: Math.round(totalProgramCosts * 100) / 100,
            loanSettlementAmount: Math.round(totalLoanSettlementAmount * 100) / 100,
          },
          netPlatformCompensation: {
            referralAmount: Math.round(totalReferralAmount * 100) / 100,
            programBenefits: Math.round(totalProgramBenefits * 100) / 100,
          },
          platformCompensation: Math.round(totalPlatformCompensation * 100) / 100,
          platformRecovery: Math.round(totalPlatformRecovery * 100) / 100,
        },
        count: aggregatedDaywise.length,
        updatedAtTimestamp: latestUpdatedAt,
        accounts: results.map((r) => ({
          account: r.account,
          error: r.error,
          header: r.data?.header,
          count: r.data?.count,
        })),
      },
    })
  }
}
