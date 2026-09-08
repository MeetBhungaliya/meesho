/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'drive.fs.serve': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'users.signup': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').createUserValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').createUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['signup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['signup']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.login': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.refresh': {
    methods: ["POST"]
    pattern: '/refresh'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['refresh']>>>
    }
  }
  'users.logout': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['logout']>>>
    }
  }
  'users.me': {
    methods: ["GET","HEAD"]
    pattern: '/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['me']>>>
    }
  }
  'accounts.get_all_accounts': {
    methods: ["GET","HEAD"]
    pattern: '/accounts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['getAllAccounts']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['getAllAccounts']>>>
    }
  }
  'dashboard.get_stats': {
    methods: ["GET","HEAD"]
    pattern: '/accounts/dashboard/stats'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['getStats']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['getStats']>>>
    }
  }
  'dashboard.get_activities': {
    methods: ["GET","HEAD"]
    pattern: '/accounts/dashboard/activities'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['getActivities']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['getActivities']>>>
    }
  }
  'dashboard.mark_activity_read': {
    methods: ["POST"]
    pattern: '/accounts/dashboard/activities/:id/read'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['markActivityRead']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['markActivityRead']>>>
    }
  }
  'dashboard.clear_activities': {
    methods: ["DELETE"]
    pattern: '/accounts/dashboard/activities/clear'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['clearActivities']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['clearActivities']>>>
    }
  }
  'dashboard.delete_activity': {
    methods: ["DELETE"]
    pattern: '/accounts/dashboard/activities/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['deleteActivity']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['deleteActivity']>>>
    }
  }
  'accounts.create_account': {
    methods: ["POST"]
    pattern: '/accounts/add-account'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').createAccountValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account').createAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['createAccount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['createAccount']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'accounts.retry_login': {
    methods: ["GET","HEAD"]
    pattern: '/accounts/retry-login/:accountId?'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['retryLogin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['retryLogin']>>>
    }
  }
  'accounts.update_password': {
    methods: ["PUT"]
    pattern: '/accounts/update-password/:accountId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').updateAccountPasswordValidator)>>
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account').updateAccountPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'accounts.update_account': {
    methods: ["PUT"]
    pattern: '/accounts/:accountId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').updateAccountValidator)>>
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account').updateAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['updateAccount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['updateAccount']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'accounts.delete_account': {
    methods: ["DELETE"]
    pattern: '/accounts/:accountId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['deleteAccount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/accounts_controller').default['deleteAccount']>>>
    }
  }
  'flexi_growth_offers.submit': {
    methods: ["POST"]
    pattern: '/accounts/flexi-growth-offer'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/flexi_growth_offers_controller').default['submit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/flexi_growth_offers_controller').default['submit']>>>
    }
  }
  'flexi_growth_offers.retry': {
    methods: ["POST"]
    pattern: '/accounts/flexi-growth-offer/retry'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/flexi_growth_offers_controller').default['retry']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/flexi_growth_offers_controller').default['retry']>>>
    }
  }
  'advertisements.submit': {
    methods: ["POST"]
    pattern: '/accounts/advertisement'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/advertisements_controller').default['submit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/advertisements_controller').default['submit']>>>
    }
  }
  'advertisements.retry': {
    methods: ["POST"]
    pattern: '/accounts/advertisement/retry'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/advertisements_controller').default['retry']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/advertisements_controller').default['retry']>>>
    }
  }
  'return_otps.fetch': {
    methods: ["POST"]
    pattern: '/accounts/return-otps'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/return_otps_controller').default['fetch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/return_otps_controller').default['fetch']>>>
    }
  }
  'images.index': {
    methods: ["GET","HEAD"]
    pattern: '/images/:accountId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').getImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/images_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/images_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'images.upload': {
    methods: ["POST"]
    pattern: '/images/:accountId/uploads'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').uploadImagesValidator)>>
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').uploadImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/images_controller').default['upload']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/images_controller').default['upload']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'images.retry': {
    methods: ["POST"]
    pattern: '/images/:accountId/retry'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').retryImagesValidator)>>
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').retryImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/images_controller').default['retry']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/images_controller').default['retry']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'images.destroy': {
    methods: ["DELETE"]
    pattern: '/images/:accountId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').deleteImagesValidator)>>
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/image').uploadImagesParamsValidator)>|InferInput<(typeof import('#validators/image').deleteImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/images_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/images_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.analytics': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/products/analytics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['analytics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['analytics']>>>
    }
  }
  'products.categories': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/products/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['categories']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['categories']>>>
    }
  }
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/product').listProductsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.store': {
    methods: ["POST"]
    pattern: '/inventory/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/product').createProductValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/product').createProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
    }
  }
  'products.update': {
    methods: ["PUT"]
    pattern: '/inventory/products/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/product').updateProductValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/product').updateProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.destroy': {
    methods: ["DELETE"]
    pattern: '/inventory/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
    }
  }
  'products.adjust_stock': {
    methods: ["POST"]
    pattern: '/inventory/products/:id/adjust-stock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/product').adjustStockValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/product').adjustStockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['adjustStock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['adjustStock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ad_account_configs.show': {
    methods: ["GET","HEAD"]
    pattern: '/ad-config/:accountId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['show']>>>
    }
  }
  'ad_account_configs.upsert': {
    methods: ["POST"]
    pattern: '/ad-config'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ad_account_config').upsertAdAccountConfigValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/ad_account_config').upsertAdAccountConfigValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['upsert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['upsert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ad_account_configs.destroy': {
    methods: ["DELETE"]
    pattern: '/ad-config/:accountId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { accountId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ad_account_configs_controller').default['destroy']>>>
    }
  }
  'jobs.active': {
    methods: ["GET","HEAD"]
    pattern: '/jobs/active'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['active']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['active']>>>
    }
  }
  'jobs.state': {
    methods: ["GET","HEAD"]
    pattern: '/jobs/:channelName/state'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { channelName: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['state']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['state']>>>
    }
  }
  'telegram_webhook.webhook': {
    methods: ["POST"]
    pattern: '/telegram/webhook'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/telegram_webhook_controller').default['webhook']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/telegram_webhook_controller').default['webhook']>>>
    }
  }
  'health_checks.health': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['health']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['health']>>>
    }
  }
}
