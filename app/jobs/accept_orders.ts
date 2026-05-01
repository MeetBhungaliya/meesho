import NotifyAcceptedOrders from '#jobs/notify_accepted_orders'
import Account from '#models/account'
import { MeeshoApiClient } from '#services/external_api/client'
import {
  MEESHO_ENDPOINTS,
  ORDER_LIMITS,
  ORDER_STATUS,
  ORDER_TYPE,
  SHIPMENT_TYPE,
} from '#services/external_api/constants'
import type {
  MeeshoAcceptOrdersResponse,
  MeeshoOrderGroup,
  MeeshoOrdersResponse,
} from '#services/external_api/types'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'

export default class AcceptOrders extends Job {
  async execute(): Promise<void> {
    logger.info('Starting AcceptOrders job')
    const accounts = await Account.query().where('autoAcceptOrders', true)

    const userAccountsMap = new Map<number, Account[]>()
    for (const account of accounts) {
      const userAccounts = userAccountsMap.get(account.userId) || []
      userAccounts.push(account)
      userAccountsMap.set(account.userId, userAccounts)
    }

    await Promise.all(
      Array.from(userAccountsMap.entries()).map(async ([userId, userAccounts]) => {
        const acceptPayloads: {
          accountId: string
          requestId: string
          totalCount: number
          supplierName: string
          isComplete: boolean
        }[] = []

        await Promise.all(
          userAccounts.map(async (account) => {
            try {
              const client = await MeeshoApiClient.forAccount(String(account.id))

              const { data: orderData } = await client.post<MeeshoOrdersResponse>(
                MEESHO_ENDPOINTS.orders,
                {
                  supplier_details: {
                    id: client.supplier.supplierId,
                    identifier: client.supplier.identifier,
                  },
                  limit: ORDER_LIMITS.FETCH_LIMIT,
                  status: ORDER_STATUS.PENDING,
                  type: ORDER_TYPE.PENDING,
                }
              )

              if (!orderData.total_count) return

              const groups: MeeshoOrderGroup[] = orderData.data.subOrders.map((subOrder) => ({
                grouping_key: subOrder.grouping_key,
                sub_order_ids: [subOrder.grouping_key],
                shipment_type: SHIPMENT_TYPE.FORWARD,
              }))

              const { data: acceptResponse } = await client
                .post<MeeshoAcceptOrdersResponse>(MEESHO_ENDPOINTS.requestPendingOrders, {
                  supplier_details: {
                    id: client.supplier.supplierId,
                    identifier: client.supplier.identifier,
                  },
                  current_status: ORDER_STATUS.PENDING,
                  requested_status: ORDER_STATUS.ACCEPTED,
                  max_transitions: ORDER_LIMITS.MAX_TRANSITIONS,
                  groups,
                })
                .catch((error) => {
                  throw error
                })

              acceptPayloads.push({
                accountId: String(account.id),
                requestId: acceptResponse.request_id,
                totalCount: orderData.total_count,
                supplierName: client.supplier.name,
                isComplete: false,
              })
            } catch (error) {
              logger.error({ accountId: account.id, error }, 'AcceptOrders failed for account')
            }
          })
        )

        if (acceptPayloads.length > 0) {
          await NotifyAcceptedOrders.dispatch({
            userId: String(userId),
            accounts: acceptPayloads,
          })
        }
      })
    )
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'AcceptOrders job failed')
  }
}
