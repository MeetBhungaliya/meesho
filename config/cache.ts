import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  default: 'default',

  stores: {
    /**
     * memoryOnly is kept for non-critical, single-process use cases.
     */
    memoryOnly: store().useL1Layer(drivers.memory()),

    /**
     * default uses Redis only (no L1 in-memory layer).
     *
     * Why: The web server and queue worker are separate processes that both
     * share the same Redis. If we add an L1 in-memory layer, each process
     * holds its own stale copy of session/supplier data. When the queue worker
     * refreshes a Meesho session, the web server's L1 still serves the old
     * cookies → API calls fail silently → dashboard shows 0 orders/payments.
     *
     * Redis-only guarantees both processes always see the latest session data.
     */
    default: store().useL2Layer(
      drivers.redis({
        connectionName: 'main',
      })
    ),
  },
})

export default cacheConfig

declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}
