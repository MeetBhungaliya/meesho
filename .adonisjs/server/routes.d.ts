import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.refresh': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'dashboard.get_stats': { paramsTuple?: []; params?: {} }
    'dashboard.get_activities': { paramsTuple?: []; params?: {} }
    'dashboard.mark_activity_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'dashboard.clear_activities': { paramsTuple?: []; params?: {} }
    'dashboard.delete_activity': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.update_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'flexi_growth_offers.submit': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.retry': { paramsTuple?: []; params?: {} }
    'advertisements.submit': { paramsTuple?: []; params?: {} }
    'advertisements.retry': { paramsTuple?: []; params?: {} }
    'return_otps.fetch': { paramsTuple?: []; params?: {} }
    'ads_campaigns.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.upload': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.retry': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.analytics': { paramsTuple?: []; params?: {} }
    'products.categories': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.adjust_stock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ad_account_configs.show': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'ad_account_configs.upsert': { paramsTuple?: []; params?: {} }
    'ad_account_configs.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'jobs.active': { paramsTuple?: []; params?: {} }
    'jobs.state': { paramsTuple: [ParamValue]; params: {'channelName': ParamValue} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'dashboard.get_stats': { paramsTuple?: []; params?: {} }
    'dashboard.get_activities': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'ads_campaigns.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.analytics': { paramsTuple?: []; params?: {} }
    'products.categories': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ad_account_configs.show': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'jobs.active': { paramsTuple?: []; params?: {} }
    'jobs.state': { paramsTuple: [ParamValue]; params: {'channelName': ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'users.me': { paramsTuple?: []; params?: {} }
    'accounts.get_all_accounts': { paramsTuple?: []; params?: {} }
    'dashboard.get_stats': { paramsTuple?: []; params?: {} }
    'dashboard.get_activities': { paramsTuple?: []; params?: {} }
    'accounts.retry_login': { paramsTuple?: [ParamValue?]; params?: {'accountId'?: ParamValue} }
    'ads_campaigns.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.index': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.analytics': { paramsTuple?: []; params?: {} }
    'products.categories': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ad_account_configs.show': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'jobs.active': { paramsTuple?: []; params?: {} }
    'jobs.state': { paramsTuple: [ParamValue]; params: {'channelName': ParamValue} }
    'health_checks.health': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.refresh': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'dashboard.mark_activity_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'accounts.create_account': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.submit': { paramsTuple?: []; params?: {} }
    'flexi_growth_offers.retry': { paramsTuple?: []; params?: {} }
    'advertisements.submit': { paramsTuple?: []; params?: {} }
    'advertisements.retry': { paramsTuple?: []; params?: {} }
    'return_otps.fetch': { paramsTuple?: []; params?: {} }
    'images.upload': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.retry': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.adjust_stock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ad_account_configs.upsert': { paramsTuple?: []; params?: {} }
    'telegram_webhook.webhook': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'dashboard.clear_activities': { paramsTuple?: []; params?: {} }
    'dashboard.delete_activity': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'accounts.delete_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'images.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ad_account_configs.destroy': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
  }
  PUT: {
    'accounts.update_password': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'accounts.update_account': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}