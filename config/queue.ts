import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, drivers, exponentialBackoff } from '@adonisjs/queue'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'redis') as 'redis' | 'sync',

  adapters: {
    redis: drivers.redis({
      connectionName: 'main',
    }),
    sync: drivers.sync(),
  },

  worker: {
    concurrency: 1,
    idleDelay: '5s',
  },

  retry: {
    maxRetries: 2,
    backoff: exponentialBackoff(),
  },

  locations: [app.makePath('app/jobs/**/*.{ts,js}')],
})
