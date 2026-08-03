import Account from '#models/account'
import transmit from '@adonisjs/transmit/services/main'

// Accounts real-time updates channel
transmit.authorize<{ userId: string }>('accounts/:userId', async (ctx, { userId }) => {
  const user = await ctx.auth.authenticate()
  return user.id === +userId
})

// Inventory real-time updates channel
transmit.authorize<{ userId: string }>('inventory/:userId', async (ctx, { userId }) => {
  const user = await ctx.auth.authenticate()
  return user.id === +userId
})

transmit.authorize<{ userId: string; accountId: string }>(
  ':userId/:accountId',
  async (ctx, { userId, accountId }) => {
    const user = await ctx.auth.authenticate()
    const account = await Account.find(Number(accountId))
    return user.id === +userId && account?.userId === user.id
  }
)
