import Account from '#models/account'
import TelegramAccount from '#models/telegram_account'
import { MeeshoApiClient } from '#services/external_api/client'
import { REDIS_KEYS, TIMEZONE } from '#services/external_api/constants'
import TelegramService from '#services/telegram_service'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

export default class AggregateAcceptedOrders extends Job {
  private telegramService = new TelegramService()

  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute(): Promise<void> {
    const yesterday = DateTime.now().setZone(TIMEZONE).minus({ days: 1 }).toFormat('yyyy-MM-dd')

    const accounts = await Account.all()
    const telegramAccounts = await TelegramAccount.query().where('isUpdates', true)

    for (const account of accounts) {
      const key = REDIS_KEYS.accountOrders(String(account.id), yesterday)
      const count = Number(await redis.get(key)) || 0
      const client = await MeeshoApiClient.forAccount(String(account.id))

      const message = [
        '📊 *Daily Order Summary*',
        `• *Name:* ${client.supplier.name}`,
        `• *Date:* ${yesterday}`,
        `• *Total Orders Accepted:* ${count}`,
      ].join('\n')

      await Promise.all(
        telegramAccounts.map((telegramAccount) =>
          this.telegramService.sendMessage(telegramAccount.userId, message, {
            parse_mode: 'Markdown',
            disable_notification: false,
          })
        )
      )
    }

    logger.info('AggregateAcceptedOrders completed')
  }

  async failed(error: Error): Promise<void> {
    logger.error({ error: error.message }, 'AggregateAcceptedOrders job failed')
  }
}
