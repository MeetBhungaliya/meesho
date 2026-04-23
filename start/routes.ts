import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router.post('/signup', [controllers.Users, 'signup'])
router.post('/login', [controllers.Users, 'login'])

router
  .group(() => {
    router
      .group(() => {
        router.post('/:accountId', [controllers.Accounts, 'createAccount'])
        router.get('/status', [controllers.Accounts, 'getAccountsStatus'])
        router.get('/:accountId/retry-login', [controllers.Accounts, 'retryLogin'])
      })
      .prefix('accounts')
  })
  .use(middleware.auth())

router.post('/telegram/webhook', [controllers.TelegramWebhook, 'webhook'])

router.get('/health', [controllers.HealthChecks, 'health'])