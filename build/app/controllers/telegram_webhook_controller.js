import TelegramService from '#services/telegram_service';
export default class TelegramWebhookController {
    telegramService = new TelegramService();
    async webhook({ request, response }) {
        const update = request.body();
        await this.telegramService.handleWebhook(update);
        return response.ok({ ok: true });
    }
}
//# sourceMappingURL=telegram_webhook_controller.js.map