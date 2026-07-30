import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.refresh': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'flexi_growth_offers.submit': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.retry': { paramsTuple?: []; params?: {} }
    'return_otps.fetch': { paramsTuple?: []; params?: {} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.upload': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.retry': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.refresh': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.submit': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.retry': { paramsTuple?: []; params?: {} }
    'return_otps.fetch': { paramsTuple?: []; params?: {} }
    'images.upload': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.retry': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
  DELETE: {
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}