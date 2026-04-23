var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column } from '@adonisjs/lucid/orm';
export class AccountSchema extends BaseModel {
    static $columns = [
        'autoAcceptOrders',
        'createdAt',
        'email',
        'id',
        'lastLoginAt',
        'password',
        'provider',
        'sessionError',
        'sessionStatus',
        'updatedAt',
        'userId',
    ];
    $columns = AccountSchema.$columns;
}
__decorate([
    column(),
    __metadata("design:type", Boolean)
], AccountSchema.prototype, "autoAcceptOrders", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], AccountSchema.prototype, "createdAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AccountSchema.prototype, "email", void 0);
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], AccountSchema.prototype, "id", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], AccountSchema.prototype, "lastLoginAt", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], AccountSchema.prototype, "password", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AccountSchema.prototype, "provider", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AccountSchema.prototype, "sessionError", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AccountSchema.prototype, "sessionStatus", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Object)
], AccountSchema.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], AccountSchema.prototype, "userId", void 0);
export class AuthAccessTokenSchema extends BaseModel {
    static $columns = [
        'abilities',
        'createdAt',
        'expiresAt',
        'hash',
        'id',
        'lastUsedAt',
        'name',
        'tokenableId',
        'type',
        'updatedAt',
    ];
    $columns = AuthAccessTokenSchema.$columns;
}
__decorate([
    column(),
    __metadata("design:type", String)
], AuthAccessTokenSchema.prototype, "abilities", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], AuthAccessTokenSchema.prototype, "createdAt", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], AuthAccessTokenSchema.prototype, "expiresAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AuthAccessTokenSchema.prototype, "hash", void 0);
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], AuthAccessTokenSchema.prototype, "id", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], AuthAccessTokenSchema.prototype, "lastUsedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AuthAccessTokenSchema.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], AuthAccessTokenSchema.prototype, "tokenableId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AuthAccessTokenSchema.prototype, "type", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Object)
], AuthAccessTokenSchema.prototype, "updatedAt", void 0);
export class TelegramAccountSchema extends BaseModel {
    static $columns = ['createdAt', 'id', 'isUpdates', 'updatedAt', 'userId'];
    $columns = TelegramAccountSchema.$columns;
}
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], TelegramAccountSchema.prototype, "createdAt", void 0);
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], TelegramAccountSchema.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], TelegramAccountSchema.prototype, "isUpdates", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Object)
], TelegramAccountSchema.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TelegramAccountSchema.prototype, "userId", void 0);
export class UserSchema extends BaseModel {
    static $columns = ['createdAt', 'email', 'id', 'password', 'updatedAt'];
    $columns = UserSchema.$columns;
}
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], UserSchema.prototype, "createdAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], UserSchema.prototype, "email", void 0);
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], UserSchema.prototype, "id", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], UserSchema.prototype, "password", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Object)
], UserSchema.prototype, "updatedAt", void 0);
//# sourceMappingURL=schema.js.map