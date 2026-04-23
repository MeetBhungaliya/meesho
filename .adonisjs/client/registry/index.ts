/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
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
  'accounts.create_account': {
    methods: ["POST"],
    pattern: '/accounts/:accountId',
    tokens: [{"old":"/accounts/:accountId","type":0,"val":"accounts","end":""},{"old":"/accounts/:accountId","type":1,"val":"accountId","end":""}],
    types: placeholder as Registry['accounts.create_account']['types'],
  },
  'accounts.get_accounts_status': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/status',
    tokens: [{"old":"/accounts/status","type":0,"val":"accounts","end":""},{"old":"/accounts/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['accounts.get_accounts_status']['types'],
  },
  'accounts.retry_login': {
    methods: ["GET","HEAD"],
    pattern: '/accounts/:accountId/retry-login',
    tokens: [{"old":"/accounts/:accountId/retry-login","type":0,"val":"accounts","end":""},{"old":"/accounts/:accountId/retry-login","type":1,"val":"accountId","end":""},{"old":"/accounts/:accountId/retry-login","type":0,"val":"retry-login","end":""}],
    types: placeholder as Registry['accounts.retry_login']['types'],
  },
  'telegram_webhook.webhook': {
    methods: ["POST"],
    pattern: '/telegram/webhook',
    tokens: [{"old":"/telegram/webhook","type":0,"val":"telegram","end":""},{"old":"/telegram/webhook","type":0,"val":"webhook","end":""}],
    types: placeholder as Registry['telegram_webhook.webhook']['types'],
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
