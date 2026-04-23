/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  users: {
    signup: typeof routes['users.signup']
    login: typeof routes['users.login']
  }
  accounts: {
    createAccount: typeof routes['accounts.create_account']
    getAccountsStatus: typeof routes['accounts.get_accounts_status']
    retryLogin: typeof routes['accounts.retry_login']
  }
  telegramWebhook: {
    webhook: typeof routes['telegram_webhook.webhook']
  }
}
