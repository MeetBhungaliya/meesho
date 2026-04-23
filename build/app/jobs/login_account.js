import Account from '#models/account';
import { SESSION_STATUS } from '#services/external_api/constants';
import { SessionManager } from '#services/external_api/session_manager';
import logger from '@adonisjs/core/services/logger';
import { Job } from '@adonisjs/queue';
export default class LoginAccount extends Job {
    static options = {
        queue: 'default',
        maxRetries: 3,
    };
    async execute() {
        const { accountId, email, password } = this.payload;
        try {
            await SessionManager.loginSync(accountId, email, password);
            logger.info({ accountId }, 'LoginAccount succeeded');
        }
        catch (error) {
            logger.error({ accountId, error: error.message }, 'LoginAccount failed');
            throw error;
        }
    }
    async failed(error) {
        const { accountId } = this.payload;
        await Account.query()
            .where('id', Number(accountId))
            .update({
            session_status: SESSION_STATUS.FAILED,
            session_error: `All retries exhausted: ${error.message}`,
        });
        logger.error({ accountId, error: error.message }, 'LoginAccount permanently failed');
    }
}
//# sourceMappingURL=login_account.js.map