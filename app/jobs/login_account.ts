import Account from '#models/account'
import { SESSION_STATUS } from '#services/external_api/constants'
import { SessionManager } from '#services/external_api/session_manager'
import type { AccountId } from '#services/external_api/types'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'

interface LoginAccountPayload {
  accountId: AccountId
  email: string
  password: string
}

export default class LoginAccount extends Job<LoginAccountPayload> {
  async execute(): Promise<void> {
    const { accountId, email, password } = this.payload

    try {
      await SessionManager.loginSync(accountId, email, password)
      logger.info({ accountId }, 'LoginAccount succeeded')
    } catch (error) {
      logger.error({ accountId, error: (error as Error).message }, 'LoginAccount failed')
      throw error
    }
  }

  async failed(error: Error): Promise<void> {
    const { accountId } = this.payload

    await Account.query()
      .where('id', Number(accountId))
      .update({
        session_status: SESSION_STATUS.FAILED,
        session_error: `All retries exhausted: ${error.message}`,
      })

    logger.error({ accountId, error: error.message }, 'LoginAccount permanently failed')
  }
}
