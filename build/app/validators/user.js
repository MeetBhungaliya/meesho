import vine from '@vinejs/vine';
const email = () => vine.string().email().maxLength(254);
const password = () => vine.string().minLength(8).maxLength(32);
export const createUserValidator = vine.create(vine.object({
    email: email().unique({ table: 'users', column: 'email' }),
    password: password(),
}));
export const loginValidator = vine.create(vine.object({
    email: email(),
    password: password(),
}));
//# sourceMappingURL=user.js.map