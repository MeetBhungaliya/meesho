/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  users: {
    signup: typeof routes['users.signup']
    login: typeof routes['users.login']
    refresh: typeof routes['users.refresh']
    logout: typeof routes['users.logout']
    me: typeof routes['users.me']
  }
  accounts: {
    getAllAccounts: typeof routes['accounts.get_all_accounts']
    createAccount: typeof routes['accounts.create_account']
    retryLogin: typeof routes['accounts.retry_login']
    updatePassword: typeof routes['accounts.update_password']
    deleteAccount: typeof routes['accounts.delete_account']
  }
  flexiGrowthOffers: {
    submit: typeof routes['flexi_growth_offers.submit']
    retry: typeof routes['flexi_growth_offers.retry']
  }
  images: {
    index: typeof routes['images.index']
    upload: typeof routes['images.upload']
    retry: typeof routes['images.retry']
    destroy: typeof routes['images.destroy']
  }
  telegramWebhook: {
    webhook: typeof routes['telegram_webhook.webhook']
  }
  healthChecks: {
    health: typeof routes['health_checks.health']
  }
}
