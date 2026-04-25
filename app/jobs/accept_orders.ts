import NotifyAcceptedOrders from '#jobs/notify_accepted_orders'
import Account from '#models/account'
import { MeeshoApiClient } from '#services/external_api/client'
import {
  MEESHO_ENDPOINTS,
  ORDER_LIMITS,
  ORDER_STATUS,
  ORDER_TYPE,
  POLLING_CONFIG,
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
    const accounts = await Account.query().where('autoAcceptOrders', true)

    await Promise.all(
      accounts.map(async (account) => {
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

          const { data: acceptResponse } = await client.post<MeeshoAcceptOrdersResponse>(
            MEESHO_ENDPOINTS.requestPendingOrders,
            {
              supplier_details: {
                id: client.supplier.supplierId,
                identifier: client.supplier.identifier,
              },
              current_status: ORDER_STATUS.PENDING,
              requested_status: ORDER_STATUS.ACCEPTED,
              max_transitions: ORDER_LIMITS.MAX_TRANSITIONS,
              groups,
            }
          )

          await NotifyAcceptedOrders.dispatch({
            requestId: acceptResponse.request_id,
            accountId: String(account.id),
          })
            .in(POLLING_CONFIG.DELAY)
            .run()
        } catch (error) {
          logger.error({ accountId: account.id, error }, 'AcceptOrders failed for account')
        }
      })
    )
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'AcceptOrders job failed')
  }
}
