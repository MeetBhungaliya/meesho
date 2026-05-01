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
    pattern: '/accounts/add-account',
    tokens: [{"old":"/accounts/add-account","type":0,"val":"accounts","end":""},{"old":"/accounts/add-account","type":0,"val":"add-account","end":""}],
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
