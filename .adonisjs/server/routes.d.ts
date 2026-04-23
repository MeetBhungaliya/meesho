import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
  HEAD: {
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}