import User from '#models/user';
import { SessionManager } from '#services/external_api/session_manager';
import { createUserValidator, loginValidator } from '#validators/user';
export default class UsersController {
    async signup({ request, response }) {
        const payload = await request.validateUsing(createUserValidator);
        const user = await User.create(payload);
        return response.created({ message: 'User created successfully', data: user });
    }
    async login({ request, response }) {
        const { email, password } = await request.validateUsing(loginValidator);
        const user = await User.verifyCredentials(email, password);
        const token = await User.accessTokens.create(user);
        await user.load((preloader) => preloader.load('accounts'));
        user.accounts.forEach((account) => SessionManager.login(account.id.toString(), account.email, account.password));
        return response.ok({
            message: 'Login successful.',
            data: {
                user,
            },
            token: token.value.release(),
        });
    }
}
//# sourceMappingURL=users_controller.js.map