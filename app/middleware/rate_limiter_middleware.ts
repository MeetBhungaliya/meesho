import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Simple in-memory sliding window rate limiter.
 *
 * For a single-server deployment this is sufficient.
 * If you scale to multiple instances, replace with Redis-backed
 * rate limiting (e.g. @adonisjs/limiter or ioredis + lua).
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000
).unref()

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key) || { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    store.set(key, entry)
    return true
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return false
}

/**
 * Rate limiter for authentication routes.
 * 10 requests per minute per IP.
 */
export default class RateLimiterMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const ip = ctx.request.ip()
    const path = ctx.request.url()

    // Tighter limit for auth routes
    const isAuthRoute = ['/login', '/signup', '/refresh'].some((r) => path.startsWith(r))
    const maxRequests = isAuthRoute ? 10 : 100
    const windowMs = 60_000 // 1 minute

    const key = `${ip}:${isAuthRoute ? 'auth' : 'api'}`

    if (isRateLimited(key, maxRequests, windowMs)) {
      ctx.response.status(429).send({
        message: 'Too many requests. Please try again later.',
        code: 'E_RATE_LIMIT',
        status: 429,
      })
      return
    }

    return next()
  }
}
