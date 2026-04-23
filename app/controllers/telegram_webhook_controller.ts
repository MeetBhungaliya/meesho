import TelegramService from '#services/telegram_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class TelegramWebhookController {
  private telegramService = new TelegramService()

  async webhook({ request, response }: HttpContext) {
    const update = request.body()
    await this.telegramService.handleWebhook(update)
    return response.ok({ ok: true })
  }
}
