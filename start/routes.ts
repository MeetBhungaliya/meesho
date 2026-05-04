import transmit from '@adonisjs/transmit/services/main'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

transmit.registerRoutes((route) => {
  route.middleware(middleware.auth())
})

router.post('/signup', [controllers.Users, 'signup'])
router.post('/login', [controllers.Users, 'login'])

router
  .group(() => {
    router
      .group(() => {
        router.get('/', [controllers.Accounts, 'getAllAccounts'])
        router.post('/add-account', [controllers.Accounts, 'createAccount'])
        router.get('/retry-login/:accountId?', [controllers.Accounts, 'retryLogin'])
        router.put('/update-password/:accountId', [controllers.Accounts, 'updatePassword'])
        router.delete('/:accountId', [controllers.Accounts, 'deleteAccount'])
      })
      .prefix('accounts')

    router
      .group(() => {
        router.get('/', [controllers.Images, 'index'])
        router.post('/uploads', [controllers.Images, 'upload'])
        router.post('/retry', [controllers.Images, 'retry'])
        router.delete('/', [controllers.Images, 'destroy'])
      })
      .prefix('images/:accountId')
  })
  .use(middleware.auth())

router.post('/telegram/webhook', [controllers.TelegramWebhook, 'webhook'])

router.get('/health', [controllers.HealthChecks, 'health'])
