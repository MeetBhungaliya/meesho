import Account from '#models/account'
import { SESSION_STATUS } from '#services/external_api/constants'
import { SessionManager } from '#services/external_api/session_manager'
import { createAccountValidator, updateAccountPasswordValidator } from '#validators/account'
import type { HttpContext } from '@adonisjs/core/http'

export default class AccountsController {
  async createAccount({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createAccountValidator)

    const user = await auth.authenticate()
    const account = await user.related('accounts').create(payload)

    SessionManager.login(account.id.toString(), account.email, account.password).catch(() => {})

    return response.created({ message: 'Account created successfully', data: account })
  }

  async getAllAccounts({ auth, response }: HttpContext) {
    const user = await auth.authenticate()
    const accounts = await Account.query().where('user_id', user.id).orderBy('id', 'asc')

    return response.ok({
      message: 'Accounts fetched successfully',
      data: accounts,
    })
  }

  async retryLogin({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    if (params.accountId) {
      const account = await Account.query()
        .where('id', params.accountId)
        .where('user_id', user.id)
        .firstOrFail()

      await SessionManager.login(account.id.toString(), account.email, account.password)

      return response.ok({
        message: 'Login retry initiated',
        data: {
          id: account.id,
          email: account.email,
          sessionStatus: account.sessionStatus,
          sessionError: account.sessionError,
          lastLoginAt: account.lastLoginAt,
        },
      })
    }

    const accounts = await Account.query().where('user_id', user.id)

    const retryPromises = accounts.map(async (account) => {
      if (account.sessionStatus !== SESSION_STATUS.ACTIVE) {
        try {
          await SessionManager.login(account.id.toString(), account.email, account.password)
        } catch (error) {
          // Ignore individual errors to allow other accounts to retry
        }
      }
    })

    await Promise.all(retryPromises)

    return response.ok({
      message: 'Login retries initiated for all applicable accounts',
    })
  }
  async updatePassword({ auth, params, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(updateAccountPasswordValidator)

    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    account.password = payload.password
    await account.save()

    return response.ok({
      message: 'Account password updated successfully',
    })
  }

  async deleteAccount({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    await account.delete()

    return response.ok({
      message: 'Account deleted successfully',
    })
  }
}
