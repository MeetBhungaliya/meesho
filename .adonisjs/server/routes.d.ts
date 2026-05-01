import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.get_accounts_status': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
  DELETE: {
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}