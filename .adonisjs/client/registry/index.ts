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
