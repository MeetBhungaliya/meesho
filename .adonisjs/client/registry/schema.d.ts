/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
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
