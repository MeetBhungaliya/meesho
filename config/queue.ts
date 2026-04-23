import env from '#start/env'
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
    concurrency: 5,
    idleDelay: '2s',
  },

  retry: {
    maxRetries: 3,
    backoff: exponentialBackoff(),
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
