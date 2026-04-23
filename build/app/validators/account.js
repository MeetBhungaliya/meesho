import vine from '@vinejs/vine';
const email = () => vine.string().email().maxLength(254);
const password = () => vine.string().minLength(8).maxLength(32);
export const createAccountValidator = vine.create(vine.object({
    email: email(),
    password: password(),
    provider: vine.string().maxLength(255).optional(),
}));
//# sourceMappingURL=account.js.map