import AcceptedOrders from '#events/accepted_orders'
import Account from '#models/account'
import TelegramAccount from '#models/telegram_account'
import { MeeshoApiClient } from '#services/external_api/client'
import { MEESHO_ENDPOINTS, POLLING_CONFIG, POPUP_STATUS } from '#services/external_api/constants'
import type {
  MeeshoOrderHistoryResponse,
  MeeshoUpdateStatusResponse,
} from '#services/external_api/types'
import TelegramService from '#services/telegram_service'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'

interface NotifyAcceptedOrdersPayload {
  requestId: string
  accountId: string
  attempt?: number
}

export default class NotifyAcceptedOrders extends Job<NotifyAcceptedOrdersPayload> {
  async execute(): Promise<void> {
    logger.info('Starting NotifyAcceptedOrders job')
    const { requestId, accountId } = this.payload
    const telegramService = new TelegramService()

    const client = await MeeshoApiClient.forAccount(accountId)

    const { data } = await client.post<MeeshoOrderHistoryResponse>(
      MEESHO_ENDPOINTS.fetchPendingOrdersHistory,
      {
        supplier_id: client.supplier.supplierId,
        identifier: client.supplier.identifier,
      }
    )

    const responseItem = data.data?.[0]

    if (!responseItem) {
      logger.warn({ accountId, requestId }, 'Empty history response')
      return
    }

    const {
      request_id: resRequestId,
      progress_percent: progressPercent,
      processed_orders_count: processedOrdersCount,
    } = responseItem

    if (resRequestId !== requestId) {
      logger.warn({ accountId, expected: requestId, received: resRequestId }, 'Request ID mismatch')
      return
    }

    if (progressPercent === POLLING_CONFIG.PROGRESS_COMPLETE) {
      await client.post<MeeshoUpdateStatusResponse>(MEESHO_ENDPOINTS.updatePendingOrderStatus, {
        supplier_id: client.supplier.supplierId,
        identifier: client.supplier.identifier,
        request_id: requestId,
        status: POPUP_STATUS.CLOSED,
      })

      const telegramAccounts = await TelegramAccount.query().where('isUpdates', true)
      await Promise.all(
        telegramAccounts.map((telegramAccount) => {
          const message = `✅ * ${processedOrdersCount} Order Accepted Successfully*\n• *Name:* ${client.supplier.name}`
          return telegramService.sendMessage(telegramAccount.userId, message, {
            parse_mode: 'Markdown',
            disable_notification: false,
          })
        })
      )

      const account = await Account.find(Number(accountId))
      if (account) {
        await emitter.emit(
          'order:accepted',
          new AcceptedOrders(accountId, account.userId, processedOrdersCount, new Date())
        )
      }

      logger.info({ accountId, processedOrdersCount }, 'Orders accepted successfully')
      return
    }

    await NotifyAcceptedOrders.dispatch({
      requestId,
      accountId,
    }).in(POLLING_CONFIG.DELAY)
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'NotifyAcceptedOrders job failed')
  }
}
