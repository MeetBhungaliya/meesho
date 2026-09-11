/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
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
    updateAccount: typeof routes['accounts.update_account']
    deleteAccount: typeof routes['accounts.delete_account']
  }
  dashboard: {
    getStats: typeof routes['dashboard.get_stats']
    getActivities: typeof routes['dashboard.get_activities']
    markActivityRead: typeof routes['dashboard.mark_activity_read']
    clearActivities: typeof routes['dashboard.clear_activities']
    deleteActivity: typeof routes['dashboard.delete_activity']
  }
  flexiGrowthOffers: {
    submit: typeof routes['flexi_growth_offers.submit']
    retry: typeof routes['flexi_growth_offers.retry']
  }
  advertisements: {
    submit: typeof routes['advertisements.submit']
    retry: typeof routes['advertisements.retry']
  }
  returnOtps: {
    fetch: typeof routes['return_otps.fetch']
  }
  adsCampaigns: {
    campaignDetails: typeof routes['ads_campaigns.campaign_details']
    pause: typeof routes['ads_campaigns.pause']
    editCatalogs: typeof routes['ads_campaigns.edit_catalogs']
    bulkPause: typeof routes['ads_campaigns.bulk_pause']
    index: typeof routes['ads_campaigns.index']
  }
  images: {
    index: typeof routes['images.index']
    upload: typeof routes['images.upload']
    retry: typeof routes['images.retry']
    destroy: typeof routes['images.destroy']
  }
  products: {
    analytics: typeof routes['products.analytics']
    categories: typeof routes['products.categories']
    index: typeof routes['products.index']
    store: typeof routes['products.store']
    show: typeof routes['products.show']
    update: typeof routes['products.update']
    destroy: typeof routes['products.destroy']
    adjustStock: typeof routes['products.adjust_stock']
  }
  adAccountConfigs: {
    show: typeof routes['ad_account_configs.show']
    upsert: typeof routes['ad_account_configs.upsert']
    destroy: typeof routes['ad_account_configs.destroy']
  }
  jobs: {
    active: typeof routes['jobs.active']
    state: typeof routes['jobs.state']
  }
  telegramWebhook: {
    webhook: typeof routes['telegram_webhook.webhook']
  }
  healthChecks: {
    health: typeof routes['health_checks.health']
  }
}
