import TelegramAccount from '#models/telegram_account'
import type { TelegramSendOptions, TelegramUpdate } from '#services/external_api/types'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

const TELEGRAM_COMMANDS = {
  START: '/start',
} as const

const TELEGRAM_MESSAGES = {
  ALREADY_REGISTERED: 'You are already registered',
  WELCOME: 'Welcome to Meesho Bot',
} as const

export default class TelegramService {
  private baseUrl = `https://api.telegram.org/bot${env.get('TELEGRAM_BOT_TOKEN')}`

  async handleWebhook(update: TelegramUpdate): Promise<void> {
    const message = update.message
    if (!message) return

    const userId = message.chat.id
    const text = message.text

    if (text === TELEGRAM_COMMANDS.START) {
      try {
        const existingAccount = await TelegramAccount.query().where('user_id', userId).first()
        if (existingAccount) {
          await this.sendMessage(userId, TELEGRAM_MESSAGES.ALREADY_REGISTERED)
          return
        }
        await TelegramAccount.create({ userId })
        await this.sendMessage(userId, TELEGRAM_MESSAGES.WELCOME)
      } catch (error) {
        logger.error({ error, userId }, 'Failed to handle /start command')
      }
    }
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramSendOptions
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode ?? 'Markdown',
          disable_notification: options?.disable_notification ?? false,
        }),
      })
      logger.debug({ chatId }, 'Telegram message sent')
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send Telegram message')
    }
  }
}
