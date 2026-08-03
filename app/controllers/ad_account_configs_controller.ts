import AdAccountConfig from '#models/ad_account_config'
import Account from '#models/account'
import { upsertAdAccountConfigValidator } from '#validators/ad_account_config'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdAccountConfigsController {
  /**
   * GET /ad-config/:accountId
   * Fetch the single ad config for an account (or 404).
   */
  async show({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    // Ensure the account belongs to this user
    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    const config = await AdAccountConfig.query()
      .where('account_id', account.id)
      .first()

    if (!config) {
      return response.ok({ data: null })
    }

    return response.ok({ data: config })
  }

  /**
   * POST /ad-config
   * Create or update (upsert) the ad config for an account.
   * Only one config per account is allowed.
   */
  async upsert({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(upsertAdAccountConfigValidator)

    // Ensure the account belongs to this user
    const account = await Account.query()
      .where('id', payload.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    const config = await AdAccountConfig.updateOrCreate(
      { accountId: account.id },
      {
        apiUrl: payload.apiUrl,
        payload: payload.payload as Record<string, unknown>,
        dynamicFields: payload.dynamicFields ?? [],
      }
    )

    return response.ok({
      message: 'Ad configuration saved successfully',
      data: config,
    })
  }

  /**
   * DELETE /ad-config/:accountId
   * Remove the ad config for an account.
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    const account = await Account.query()
      .where('id', params.accountId)
      .where('user_id', user.id)
      .firstOrFail()

    const deleted = await AdAccountConfig.query()
      .where('account_id', account.id)
      .delete()

    if (deleted[0] === 0) {
      return response.notFound({ message: 'No configuration found' })
    }

    return response.ok({ message: 'Ad configuration deleted' })
  }
}
