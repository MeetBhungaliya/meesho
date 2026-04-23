import Account from '#models/account';
import User from '#models/user';
import { SESSION_STATUS } from '#services/external_api/constants';
import { SessionManager } from '#services/external_api/session_manager';
import { createAccountValidator } from '#validators/account';
export default class AccountsController {
    async createAccount({ request, response, params }) {
        const payload = await request.validateUsing(createAccountValidator);
        const user = await User.findOrFail(params.accountId);
        const account = await user.related('accounts').create(payload);
        return response.created({ message: 'Account created successfully', data: account });
    }
    async getAccountsStatus({ auth, response }) {
        const user = await auth.authenticate();
        await user.load((preloader) => preloader.load('accounts'));
        const accountStatuses = user.accounts.map((account) => ({
            id: account.id,
            email: account.email,
            provider: account.provider,
            sessionStatus: account.sessionStatus,
            sessionError: account.sessionError,
            lastLoginAt: account.lastLoginAt,
        }));
        const summary = {
            total: accountStatuses.length,
            active: accountStatuses.filter((a) => a.sessionStatus === SESSION_STATUS.ACTIVE).length,
            pending: accountStatuses.filter((a) => a.sessionStatus === SESSION_STATUS.PENDING).length,
            failed: accountStatuses.filter((a) => a.sessionStatus === SESSION_STATUS.FAILED).length,
            expired: accountStatuses.filter((a) => a.sessionStatus === SESSION_STATUS.EXPIRED).length,
        };
        return response.ok({
            message: 'Account session statuses',
            data: { accounts: accountStatuses, summary },
        });
    }
    async retryLogin({ auth, params, response }) {
        const user = await auth.authenticate();
        const account = await Account.query()
            .where('id', params.accountId)
            .where('user_id', user.id)
            .firstOrFail();
        if (account.sessionStatus === SESSION_STATUS.ACTIVE) {
            return response.ok({ message: 'Session is already active', data: account });
        }
        await SessionManager.login(account.id.toString(), account.email, account.password);
        return response.ok({
            message: 'Login retry initiated',
            data: {
                id: account.id,
                email: account.email,
                sessionStatus: account.sessionStatus,
                sessionError: account.sessionError,
                lastLoginAt: account.lastLoginAt,
            },
        });
    }
}
//# sourceMappingURL=accounts_controller.js.map