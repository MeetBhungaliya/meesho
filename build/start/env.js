import { Env } from '@adonisjs/core/env';
export default await Env.create(new URL('../', import.meta.url), {
    NODE_ENV: Env.schema.enum(['development', 'production', 'test']),
    PORT: Env.schema.number(),
    HOST: Env.schema.string({ format: 'host' }),
    LOG_LEVEL: Env.schema.string(),
    APP_KEY: Env.schema.secret(),
    APP_URL: Env.schema.string({ format: 'url', tld: false }),
    SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database']),
    REDIS_HOST: Env.schema.string({ format: 'host' }),
    REDIS_PORT: Env.schema.number(),
    REDIS_PASSWORD: Env.schema.secret.optional(),
    QUEUE_DRIVER: Env.schema.enum(['redis', 'database', 'sync']),
    TELEGRAM_BOT_TOKEN: Env.schema.string(),
});
//# sourceMappingURL=env.js.map