/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
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
  'accounts.delete_account': {
    methods: ["DELETE"],
    pattern: '/accounts/:accountId',
    tokens: [{"old":"/accounts/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.delete_account']['types'],
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
