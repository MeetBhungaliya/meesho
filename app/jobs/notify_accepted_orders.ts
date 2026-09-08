import AcceptedOrders from '#events/accepted_orders'
import { events } from '#generated/events'
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

interface AccountPayload {
  accountId: string
  requestId: string
  totalCount: number
  supplierName: string
  isComplete: boolean
  processedCount?: number
}

interface NotifyAcceptedOrdersPayload {
  userId: string
  accounts: AccountPayload[]
  attempt?: number
}

export default class NotifyAcceptedOrders extends Job<NotifyAcceptedOrdersPayload> {
  async execute(): Promise<void> {
    const { userId, accounts } = this.payload
    const telegramService = new TelegramService()

    let allComplete = true

    await Promise.all(
      accounts.map(async (acc) => {
        if (acc.isComplete) return

        try {
          const client = await MeeshoApiClient.forAccount(acc.accountId)

          const { data } = await client.post<MeeshoOrderHistoryResponse>(
            MEESHO_ENDPOINTS.fetchPendingOrdersHistory,
            {
              supplier_id: client.supplier.supplierId,
              identifier: client.supplier.identifier,
            }
          )

          const responseItem = data.data?.find((item) => item.request_id === acc.requestId)

          if (!responseItem) {
            logger.warn(
              { accountId: acc.accountId, requestId: acc.requestId },
              'Matching history item not found yet'
            )
            allComplete = false
            return
          }

          const {
            progress_percent: progressPercent,
            processed_orders_count: processedOrdersCount,
          } = responseItem

          if (progressPercent === POLLING_CONFIG.PROGRESS_COMPLETE) {
            await client
              .post<MeeshoUpdateStatusResponse>(MEESHO_ENDPOINTS.updatePendingOrderStatus, {
                supplier_id: client.supplier.supplierId,
                identifier: client.supplier.identifier,
                request_id: acc.requestId,
                status: POPUP_STATUS.CLOSED,
              })
              .catch((error) => {
                logger.error({ error, accountId: acc.accountId }, 'Failed to update order status')
              })

            const account = await Account.find(Number(acc.accountId))
            if (account && processedOrdersCount > 0) {
              await emitter.emit(
                events.AcceptedOrders,
                new AcceptedOrders(acc.accountId, account.userId, processedOrdersCount, new Date())
              )
            }

            acc.isComplete = true
            acc.processedCount = processedOrdersCount
          } else {
            allComplete = false
          }
        } catch (error) {
          logger.error({ accountId: acc.accountId, error }, 'Error processing account history')
          allComplete = false
        }
      })
    )

    if (allComplete) {
      const telegramAccounts = await TelegramAccount.query().where('isUpdates', true)

      const accountMessages = accounts.map((acc) => {
        const count = acc.processedCount || 0
        return `• *${acc.supplierName}:* ${count} Orders`
      })

      const message = accountMessages.join('\n')

      await Promise.all(
        telegramAccounts.map((telegramAccount) => {
          return telegramService.sendMessage(telegramAccount.userId, message, {
            parse_mode: 'Markdown',
            disable_notification: false,
          })
        })
      )
      return
    }

    const currentAttempt = this.payload.attempt || 0
    if (currentAttempt >= POLLING_CONFIG.MAX_ATTEMPTS) {
      logger.warn({ userId, accounts }, 'NotifyAcceptedOrders reached maximum polling attempts')
      return
    }

    await NotifyAcceptedOrders.dispatch({
      userId,
      accounts,
      attempt: currentAttempt + 1,
    }).in(POLLING_CONFIG.DELAY)
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'NotifyAcceptedOrders job failed')
  }
}
