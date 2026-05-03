/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  users: {
    signup: typeof routes['users.signup']
    login: typeof routes['users.login']
  }
  accounts: {
    getAllAccounts: typeof routes['accounts.get_all_accounts']
    createAccount: typeof routes['accounts.create_account']
    getAccountsStatus: typeof routes['accounts.get_accounts_status']
    retryLogin: typeof routes['accounts.retry_login']
    updatePassword: typeof routes['accounts.update_password']
    deleteAccount: typeof routes['accounts.delete_account']
  }
  images: {
    upload: typeof routes['images.upload']
    index: typeof routes['images.index']
  }
  telegramWebhook: {
    webhook: typeof routes['telegram_webhook.webhook']
  }
  healthChecks: {
    health: typeof routes['health_checks.health']
  }
}
