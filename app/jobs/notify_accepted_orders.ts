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
    logger.info('Starting NotifyAcceptedOrders job')
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

          const responseItem = data.data?.[0]

          if (!responseItem) {
            logger.warn({ accountId: acc.accountId, requestId: acc.requestId }, 'Empty history response')
            allComplete = false
            return
          }

          const {
            request_id: resRequestId,
            progress_percent: progressPercent,
            processed_orders_count: processedOrdersCount,
          } = responseItem

          if (resRequestId !== acc.requestId) {
            logger.warn({ accountId: acc.accountId, expected: acc.requestId, received: resRequestId }, 'Request ID mismatch')
            allComplete = false
            return
          }

          if (progressPercent === POLLING_CONFIG.PROGRESS_COMPLETE) {
            await client.post<MeeshoUpdateStatusResponse>(MEESHO_ENDPOINTS.updatePendingOrderStatus, {
              supplier_id: client.supplier.supplierId,
              identifier: client.supplier.identifier,
              request_id: acc.requestId,
              status: POPUP_STATUS.CLOSED,
            }).catch(error => {
              logger.error({ error, accountId: acc.accountId }, 'Failed to update order status')
            })

            const account = await Account.find(Number(acc.accountId))
            if (account) {
              await emitter.emit(
                'order:accepted',
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
      
      let totalCountSum = accounts.reduce((sum, curr) => sum + curr.totalCount, 0)
      
      let message = `✅ *${totalCountSum} Orders Accepted Successfully*\n\n`
      for (const acc of accounts) {
        message += `• *${acc.supplierName}:* ${acc.totalCount} Orders\n`
      }

      await Promise.all(
        telegramAccounts.map((telegramAccount) => {
          return telegramService.sendMessage(telegramAccount.userId, message, {
            parse_mode: 'Markdown',
            disable_notification: false,
          })
        })
      )

      logger.info({ userId }, 'Orders accepted successfully for all accounts of user')
      return
    }

    await NotifyAcceptedOrders.dispatch({
      userId,
      accounts,
      attempt: (this.payload.attempt || 0) + 1,
    }).in(POLLING_CONFIG.DELAY)
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'NotifyAcceptedOrders job failed')
  }
}
