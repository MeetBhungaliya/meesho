import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class CookieToAuthHeaderMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = ctx.request.cookie('access_token')
    if (token) {
      // Set the authorization header on the request object.
      // In AdonisJS v6, request.headers is a getter property, and mutating request.request.headers is standard.
      ctx.request.request.headers['authorization'] = `Bearer ${token}`
    }
    return next()
  }
}
