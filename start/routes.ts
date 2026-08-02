import transmit from '@adonisjs/transmit/services/main'
import { controllers } from '#generated/controllers'
const ReturnOtpsController = () => import('#controllers/return_otps_controller')
const ProductsController = () => import('#controllers/products_controller')
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

transmit.registerRoutes((route) => {
  if (route.getPattern().includes('subscribe') || route.getPattern().includes('unsubscribe')) {
    route.middleware(middleware.auth())
  }
})

router.post('/signup', [controllers.Users, 'signup'])
router.post('/login', [controllers.Users, 'login'])
router.post('/refresh', [controllers.Users, 'refresh'])
router.post('/logout', [controllers.Users, 'logout'])
router.get('/me', [controllers.Users, 'me']).use(middleware.auth())

router
  .group(() => {
    router
      .group(() => {
        router.get('/', [controllers.Accounts, 'getAllAccounts'])
        router.post('/add-account', [controllers.Accounts, 'createAccount'])
        router.get('/retry-login/:accountId?', [controllers.Accounts, 'retryLogin'])
        router.put('/update-password/:accountId', [controllers.Accounts, 'updatePassword'])
        router.delete('/:accountId', [controllers.Accounts, 'deleteAccount'])
        router.post('/flexi-growth-offer', [controllers.FlexiGrowthOffers, 'submit'])
        router.post('/flexi-growth-offer/retry', [controllers.FlexiGrowthOffers, 'retry'])
        router.post('/return-otps', [ReturnOtpsController, 'fetch'])
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

    // Inventory / Products
    router
      .group(() => {
        router.get('/analytics', [ProductsController, 'analytics'])

        router.get('/categories', [ProductsController, 'categories'])
        router.get('/', [ProductsController, 'index'])
        router.post('/', [ProductsController, 'store'])
        router.get('/:id', [ProductsController, 'show'])
        router.put('/:id', [ProductsController, 'update'])
        router.delete('/:id', [ProductsController, 'destroy'])
        router.post('/:id/adjust-stock', [ProductsController, 'adjustStock'])
      })
      .prefix('inventory/products')
  })
  .use(middleware.auth())

router.post('/telegram/webhook', [controllers.TelegramWebhook, 'webhook'])

router.get('/health', [controllers.HealthChecks, 'health'])
