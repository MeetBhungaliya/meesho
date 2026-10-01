import app from '@adonisjs/core/services/app'
import Ws from '#services/ws'
import Account from '#models/account'

app.ready(() => {
  Ws.boot()

  // Accounts real-time updates channel
  Ws.authorize('accounts/:userId', (user, { userId }) => {
    return user?.id === +userId
  })

  // Inventory real-time updates channel
  Ws.authorize('inventory/:userId', (user, { userId }) => {
    return user?.id === +userId
  })

  // Account-specific image / shipping price updates channel (:userId/:accountId)
  Ws.authorize(':userId/:accountId', async (user, { userId, accountId }) => {
    if (!user || user.id !== +userId) return false
    const account = await Account.find(Number(accountId))
    return account?.userId === user.id
  })

  // User-specific updates channel (:userId)
  Ws.authorize(':userId', (user, { userId }) => {
    return user?.id === +userId
  })

  // Ad launch job progress channel
  Ws.authorize('ad-launch::jobId', (user) => {
    return user !== null
  })

  // Flexi growth offer job progress channel
  Ws.authorize('flexi-growth-offer::jobId', (user) => {
    return user !== null
  })
})
