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

// Meesho Labels user-level channel
transmit.authorize<{ userId: string }>('meesho-labels/:userId', async (ctx, { userId }) => {
  try {
    const user = await ctx.auth.authenticate()
    const isAuthorized = user.id === +userId
    if (!isAuthorized) {
      console.error(`[Transmit Auth] Unauthorized: user.id (${user.id}) !== userId (${userId})`)
    }
    return isAuthorized
  } catch (err) {
    console.error('[Transmit Auth] Exception during authentication:', err)
    throw err
  }
})

// Meesho Labels job-level stream channel
transmit.authorize<{ jobId: string }>('meesho-labels/job/:jobId', async (ctx, { jobId }) => {
  try {
    const user = await ctx.auth.authenticate()
    const { default: MeeshoLabelJob } = await import('#models/meesho_label_job')
    const job = await MeeshoLabelJob.find(jobId)
    const isAuthorized = job !== null && job.userId === user.id
    if (!isAuthorized) {
      console.error(
        `[Transmit Auth] Unauthorized job: job !== null (${job !== null}), job.userId (${job?.userId}) !== user.id (${user.id})`
      )
    }
    return isAuthorized
  } catch (err) {
    console.error('[Transmit Auth] Exception during job authentication:', err)
    throw err
  }
})
