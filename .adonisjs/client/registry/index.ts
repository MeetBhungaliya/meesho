/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'drive.fs.serve': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/*',
    tokens: [{"old":"/uploads/*","type":0,"val":"uploads","end":""},{"old":"/uploads/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['drive.fs.serve']['types'],
  },
  'event_stream': {
    methods: ["GET","HEAD"],
    pattern: '/__transmit/events',
    tokens: [{"old":"/__transmit/events","type":0,"val":"__transmit","end":""},{"old":"/__transmit/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['event_stream']['types'],
  },
  'subscribe': {
    methods: ["POST"],
    pattern: '/__transmit/subscribe',
    tokens: [{"old":"/__transmit/subscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/subscribe","type":0,"val":"subscribe","end":""}],
    types: placeholder as Registry['subscribe']['types'],
  },
  'unsubscribe': {
    methods: ["POST"],
    pattern: '/__transmit/unsubscribe',
    tokens: [{"old":"/__transmit/unsubscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/unsubscribe","type":0,"val":"unsubscribe","end":""}],
    types: placeholder as Registry['unsubscribe']['types'],
  },
  'users.signup': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['users.signup']['types'],
  },
  'users.login': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['users.login']['types'],
  },
  'users.refresh': {
    methods: ["POST"],
    pattern: '/refresh',
    tokens: [{"old":"/refresh","type":0,"val":"refresh","end":""}],
    types: placeholder as Registry['users.refresh']['types'],
  },
  'users.logout': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['users.logout']['types'],
  },
  'users.me': {
    methods: ["GET","HEAD"],
    pattern: '/me',
    tokens: [{"old":"/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['users.me']['types'],
  },
  'accounts.get_all_accounts': {
    methods: ["GET","HEAD"],
    pattern: '/accounts',
    tokens: [{"old":"/accounts","type":0,"val":"accounts","end":""}],
    types: placeholder as Registry['accounts.get_all_accounts']['types'],
  },
  'dashboard.get_stats': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/dashboard/stats',
    tokens: [{"old":"/accounts/dashboard/stats","type":0,"val":"accounts","end":""},{"old":"/accounts/dashboard/stats","type":0,"val":"dashboard","end":""},{"old":"/accounts/dashboard/stats","type":0,"val":"stats","end":""}],
    types: placeholder as Registry['dashboard.get_stats']['types'],
  },
  'dashboard.get_activities': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/dashboard/activities',
    tokens: [{"old":"/accounts/dashboard/activities","type":0,"val":"accounts","end":""},{"old":"/accounts/dashboard/activities","type":0,"val":"dashboard","end":""},{"old":"/accounts/dashboard/activities","type":0,"val":"activities","end":""}],
    types: placeholder as Registry['dashboard.get_activities']['types'],
  },
  'dashboard.mark_activity_read': {
    methods: ["POST"],
    pattern: '/accounts/dashboard/activities/:id/read',
    tokens: [{"old":"/accounts/dashboard/activities/:id/read","type":0,"val":"accounts","end":""},{"old":"/accounts/dashboard/activities/:id/read","type":0,"val":"dashboard","end":""},{"old":"/accounts/dashboard/activities/:id/read","type":0,"val":"activities","end":""},{"old":"/accounts/dashboard/activities/:id/read","type":1,"val":"id","end":""},{"old":"/accounts/dashboard/activities/:id/read","type":0,"val":"read","end":""}],
    types: placeholder as Registry['dashboard.mark_activity_read']['types'],
  },
  'dashboard.clear_activities': {
    methods: ["DELETE"],
    pattern: '/accounts/dashboard/activities/clear',
    tokens: [{"old":"/accounts/dashboard/activities/clear","type":0,"val":"accounts","end":""},{"old":"/accounts/dashboard/activities/clear","type":0,"val":"dashboard","end":""},{"old":"/accounts/dashboard/activities/clear","type":0,"val":"activities","end":""},{"old":"/accounts/dashboard/activities/clear","type":0,"val":"clear","end":""}],
    types: placeholder as Registry['dashboard.clear_activities']['types'],
  },
  'dashboard.delete_activity': {
    methods: ["DELETE"],
    pattern: '/accounts/dashboard/activities/:id',
    tokens: [{"old":"/accounts/dashboard/activities/:id","type":0,"val":"accounts","end":""},{"old":"/accounts/dashboard/activities/:id","type":0,"val":"dashboard","end":""},{"old":"/accounts/dashboard/activities/:id","type":0,"val":"activities","end":""},{"old":"/accounts/dashboard/activities/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['dashboard.delete_activity']['types'],
  },
  'accounts.create_account': {
    methods: ["POST"],
    pattern: '/accounts/add-account',
    tokens: [{"old":"/accounts/add-account","type":0,"val":"accounts","end":""},{"old":"/accounts/add-account","type":0,"val":"add-account","end":""}],
    types: placeholder as Registry['accounts.create_account']['types'],
  },
  'accounts.retry_login': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/retry-login/:accountId?',
    tokens: [{"old":"/accounts/retry-login/:accountId?","type":0,"val":"accounts","end":""},{"old":"/accounts/retry-login/:accountId?","type":0,"val":"retry-login","end":""},{"old":"/accounts/retry-login/:accountId?","type":3,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.retry_login']['types'],
  },
  'accounts.update_password': {
    methods: ["PUT"],
    pattern: '/accounts/update-password/:accountId',
    tokens: [{"old":"/accounts/update-password/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/update-password/:accountId","type":0,"val":"update-password","end":""},{"old":"/accounts/update-password/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.update_password']['types'],
  },
  'accounts.update_account': {
    methods: ["PUT"],
    pattern: '/accounts/:accountId',
    tokens: [{"old":"/accounts/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.update_account']['types'],
  },
  'accounts.delete_account': {
    methods: ["DELETE"],
    pattern: '/accounts/:accountId',
    tokens: [{"old":"/accounts/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.delete_account']['types'],
  },
  'flexi_growth_offers.submit': {
    methods: ["POST"],
    pattern: '/accounts/flexi-growth-offer',
    tokens: [{"old":"/accounts/flexi-growth-offer","type":0,"val":"accounts","end":""},{"old":"/accounts/flexi-growth-offer","type":0,"val":"flexi-growth-offer","end":""}],
    types: placeholder as Registry['flexi_growth_offers.submit']['types'],
  },
  'flexi_growth_offers.retry': {
    methods: ["POST"],
    pattern: '/accounts/flexi-growth-offer/retry',
    tokens: [{"old":"/accounts/flexi-growth-offer/retry","type":0,"val":"accounts","end":""},{"old":"/accounts/flexi-growth-offer/retry","type":0,"val":"flexi-growth-offer","end":""},{"old":"/accounts/flexi-growth-offer/retry","type":0,"val":"retry","end":""}],
    types: placeholder as Registry['flexi_growth_offers.retry']['types'],
  },
  'advertisements.submit': {
    methods: ["POST"],
    pattern: '/accounts/advertisement',
    tokens: [{"old":"/accounts/advertisement","type":0,"val":"accounts","end":""},{"old":"/accounts/advertisement","type":0,"val":"advertisement","end":""}],
    types: placeholder as Registry['advertisements.submit']['types'],
  },
  'advertisements.retry': {
    methods: ["POST"],
    pattern: '/accounts/advertisement/retry',
    tokens: [{"old":"/accounts/advertisement/retry","type":0,"val":"accounts","end":""},{"old":"/accounts/advertisement/retry","type":0,"val":"advertisement","end":""},{"old":"/accounts/advertisement/retry","type":0,"val":"retry","end":""}],
    types: placeholder as Registry['advertisements.retry']['types'],
  },
  'return_otps.fetch': {
    methods: ["POST"],
    pattern: '/accounts/return-otps',
    tokens: [{"old":"/accounts/return-otps","type":0,"val":"accounts","end":""},{"old":"/accounts/return-otps","type":0,"val":"return-otps","end":""}],
    types: placeholder as Registry['return_otps.fetch']['types'],
  },
  'ads_campaigns.campaign_details': {
    methods: ["POST"],
    pattern: '/accounts/ads/campaigns/details',
    tokens: [{"old":"/accounts/ads/campaigns/details","type":0,"val":"accounts","end":""},{"old":"/accounts/ads/campaigns/details","type":0,"val":"ads","end":""},{"old":"/accounts/ads/campaigns/details","type":0,"val":"campaigns","end":""},{"old":"/accounts/ads/campaigns/details","type":0,"val":"details","end":""}],
    types: placeholder as Registry['ads_campaigns.campaign_details']['types'],
  },
  'ads_campaigns.pause': {
    methods: ["POST"],
    pattern: '/accounts/ads/campaigns/pause',
    tokens: [{"old":"/accounts/ads/campaigns/pause","type":0,"val":"accounts","end":""},{"old":"/accounts/ads/campaigns/pause","type":0,"val":"ads","end":""},{"old":"/accounts/ads/campaigns/pause","type":0,"val":"campaigns","end":""},{"old":"/accounts/ads/campaigns/pause","type":0,"val":"pause","end":""}],
    types: placeholder as Registry['ads_campaigns.pause']['types'],
  },
  'ads_campaigns.edit_catalogs': {
    methods: ["POST"],
    pattern: '/accounts/ads/campaigns/edit-catalogs',
    tokens: [{"old":"/accounts/ads/campaigns/edit-catalogs","type":0,"val":"accounts","end":""},{"old":"/accounts/ads/campaigns/edit-catalogs","type":0,"val":"ads","end":""},{"old":"/accounts/ads/campaigns/edit-catalogs","type":0,"val":"campaigns","end":""},{"old":"/accounts/ads/campaigns/edit-catalogs","type":0,"val":"edit-catalogs","end":""}],
    types: placeholder as Registry['ads_campaigns.edit_catalogs']['types'],
  },
  'ads_campaigns.bulk_pause': {
    methods: ["POST"],
    pattern: '/accounts/ads/campaigns/bulk-pause',
    tokens: [{"old":"/accounts/ads/campaigns/bulk-pause","type":0,"val":"accounts","end":""},{"old":"/accounts/ads/campaigns/bulk-pause","type":0,"val":"ads","end":""},{"old":"/accounts/ads/campaigns/bulk-pause","type":0,"val":"campaigns","end":""},{"old":"/accounts/ads/campaigns/bulk-pause","type":0,"val":"bulk-pause","end":""}],
    types: placeholder as Registry['ads_campaigns.bulk_pause']['types'],
  },
  'ads_campaigns.index': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/ads/campaigns/:accountId',
    tokens: [{"old":"/accounts/ads/campaigns/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/ads/campaigns/:accountId","type":0,"val":"ads","end":""},{"old":"/accounts/ads/campaigns/:accountId","type":0,"val":"campaigns","end":""},{"old":"/accounts/ads/campaigns/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['ads_campaigns.index']['types'],
  },
  'images.index': {
    methods: ["GET","HEAD"],
    pattern: '/images/:accountId',
    tokens: [{"old":"/images/:accountId","type":0,"val":"images","end":""},{"old":"/images/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['images.index']['types'],
  },
  'images.upload': {
    methods: ["POST"],
    pattern: '/images/:accountId/uploads',
    tokens: [{"old":"/images/:accountId/uploads","type":0,"val":"images","end":""},{"old":"/images/:accountId/uploads","type":1,"val":"accountId","end":""},{"old":"/images/:accountId/uploads","type":0,"val":"uploads","end":""}],
    types: placeholder as Registry['images.upload']['types'],
  },
  'images.retry': {
    methods: ["POST"],
    pattern: '/images/:accountId/retry',
    tokens: [{"old":"/images/:accountId/retry","type":0,"val":"images","end":""},{"old":"/images/:accountId/retry","type":1,"val":"accountId","end":""},{"old":"/images/:accountId/retry","type":0,"val":"retry","end":""}],
    types: placeholder as Registry['images.retry']['types'],
  },
  'images.destroy': {
    methods: ["DELETE"],
    pattern: '/images/:accountId',
    tokens: [{"old":"/images/:accountId","type":0,"val":"images","end":""},{"old":"/images/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['images.destroy']['types'],
  },
  'products.analytics': {
    methods: ["GET","HEAD"],
    pattern: '/inventory/products/analytics',
    tokens: [{"old":"/inventory/products/analytics","type":0,"val":"inventory","end":""},{"old":"/inventory/products/analytics","type":0,"val":"products","end":""},{"old":"/inventory/products/analytics","type":0,"val":"analytics","end":""}],
    types: placeholder as Registry['products.analytics']['types'],
  },
  'products.categories': {
    methods: ["GET","HEAD"],
    pattern: '/inventory/products/categories',
    tokens: [{"old":"/inventory/products/categories","type":0,"val":"inventory","end":""},{"old":"/inventory/products/categories","type":0,"val":"products","end":""},{"old":"/inventory/products/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['products.categories']['types'],
  },
  'products.index': {
    methods: ["GET","HEAD"],
    pattern: '/inventory/products',
    tokens: [{"old":"/inventory/products","type":0,"val":"inventory","end":""},{"old":"/inventory/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.index']['types'],
  },
  'products.store': {
    methods: ["POST"],
    pattern: '/inventory/products',
    tokens: [{"old":"/inventory/products","type":0,"val":"inventory","end":""},{"old":"/inventory/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.store']['types'],
  },
  'products.show': {
    methods: ["GET","HEAD"],
    pattern: '/inventory/products/:id',
    tokens: [{"old":"/inventory/products/:id","type":0,"val":"inventory","end":""},{"old":"/inventory/products/:id","type":0,"val":"products","end":""},{"old":"/inventory/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.show']['types'],
  },
  'products.update': {
    methods: ["PUT"],
    pattern: '/inventory/products/:id',
    tokens: [{"old":"/inventory/products/:id","type":0,"val":"inventory","end":""},{"old":"/inventory/products/:id","type":0,"val":"products","end":""},{"old":"/inventory/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.update']['types'],
  },
  'products.destroy': {
    methods: ["DELETE"],
    pattern: '/inventory/products/:id',
    tokens: [{"old":"/inventory/products/:id","type":0,"val":"inventory","end":""},{"old":"/inventory/products/:id","type":0,"val":"products","end":""},{"old":"/inventory/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.destroy']['types'],
  },
  'products.adjust_stock': {
    methods: ["POST"],
    pattern: '/inventory/products/:id/adjust-stock',
    tokens: [{"old":"/inventory/products/:id/adjust-stock","type":0,"val":"inventory","end":""},{"old":"/inventory/products/:id/adjust-stock","type":0,"val":"products","end":""},{"old":"/inventory/products/:id/adjust-stock","type":1,"val":"id","end":""},{"old":"/inventory/products/:id/adjust-stock","type":0,"val":"adjust-stock","end":""}],
    types: placeholder as Registry['products.adjust_stock']['types'],
  },
  'ad_account_configs.show': {
    methods: ["GET","HEAD"],
    pattern: '/ad-config/:accountId',
    tokens: [{"old":"/ad-config/:accountId","type":0,"val":"ad-config","end":""},{"old":"/ad-config/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['ad_account_configs.show']['types'],
  },
  'ad_account_configs.upsert': {
    methods: ["POST"],
    pattern: '/ad-config',
    tokens: [{"old":"/ad-config","type":0,"val":"ad-config","end":""}],
    types: placeholder as Registry['ad_account_configs.upsert']['types'],
  },
  'ad_account_configs.destroy': {
    methods: ["DELETE"],
    pattern: '/ad-config/:accountId',
    tokens: [{"old":"/ad-config/:accountId","type":0,"val":"ad-config","end":""},{"old":"/ad-config/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['ad_account_configs.destroy']['types'],
  },
  'jobs.active': {
    methods: ["GET","HEAD"],
    pattern: '/jobs/active',
    tokens: [{"old":"/jobs/active","type":0,"val":"jobs","end":""},{"old":"/jobs/active","type":0,"val":"active","end":""}],
    types: placeholder as Registry['jobs.active']['types'],
  },
  'jobs.state': {
    methods: ["GET","HEAD"],
    pattern: '/jobs/:channelName/state',
    tokens: [{"old":"/jobs/:channelName/state","type":0,"val":"jobs","end":""},{"old":"/jobs/:channelName/state","type":1,"val":"channelName","end":""},{"old":"/jobs/:channelName/state","type":0,"val":"state","end":""}],
    types: placeholder as Registry['jobs.state']['types'],
  },
  'telegram_webhook.webhook': {
    methods: ["POST"],
    pattern: '/telegram/webhook',
    tokens: [{"old":"/telegram/webhook","type":0,"val":"telegram","end":""},{"old":"/telegram/webhook","type":0,"val":"webhook","end":""}],
    types: placeholder as Registry['telegram_webhook.webhook']['types'],
  },
  'health_checks.health': {
    methods: ["GET","HEAD"],
    pattern: '/health',
    tokens: [{"old":"/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health_checks.health']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
