import Account from '#models/account'
import { SESSION_STATUS } from '#services/external_api/constants'
import { SessionManager } from '#services/external_api/session_manager'
import {
  createAccountValidator,
  updateAccountPasswordValidator,
  updateAccountValidator,
} from '#validators/account'
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

    const data = await Promise.all(
      accounts.map(async (account) => {
        const supplierData = await SessionManager.getSupplierData(account.id.toString())
        return {
          ...account.serialize(),
          supplierData,
        }
      })
    )

    return response.ok({
      message: 'Accounts fetched successfully',
      data,
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

    SessionManager.login(account.id.toString(), account.email, account.password).catch(() => {})

    return response.ok({
      message: 'Account password updated successfully',
      data: account,
    })
  }

  async updateAccount({ auth, params, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(updateAccountValidator)

    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    let credentialsChanged = false
    if (payload.email && payload.email !== account.email) {
      account.email = payload.email
      credentialsChanged = true
    }
    if (payload.password) {
      account.password = payload.password
      credentialsChanged = true
    }
    if (payload.autoAcceptOrders !== undefined) {
      account.autoAcceptOrders = payload.autoAcceptOrders
    }

    await account.save()

    await SessionManager.broadcastAccountState(account)

    if (credentialsChanged) {
      SessionManager.login(account.id.toString(), account.email, account.password).catch(() => {})
    }

    return response.ok({
      message: 'Account updated successfully',
      data: account,
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
