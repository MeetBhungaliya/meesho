import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router.post('/signup', [controllers.Users, 'signup'])
router.post('/login', [controllers.Users, 'login'])

router
  .group(() => {
    router
      .group(() => {
        router.get('/', [controllers.Accounts, 'getAllAccounts'])
        router.post('/add-account', [controllers.Accounts, 'createAccount'])
        router.get('/status', [controllers.Accounts, 'getAccountsStatus'])
        router.get('/retry-login/:accountId?', [controllers.Accounts, 'retryLogin'])
        router.put('/update-password/:accountId', [controllers.Accounts, 'updatePassword'])
        router.delete('/:accountId', [controllers.Accounts, 'deleteAccount'])
      })
      .prefix('accounts')
  })
  .use(middleware.auth())

router.post('/telegram/webhook', [controllers.TelegramWebhook, 'webhook'])

router.get('/health', [controllers.HealthChecks, 'health'])
