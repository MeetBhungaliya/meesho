var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { TelegramAccountSchema } from '#database/schema';
import { column } from '@adonisjs/lucid/orm';
import { DateTime } from 'luxon';
export default class TelegramAccount extends TelegramAccountSchema {
    static table = 'telegram_accounts';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], TelegramAccount.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], TelegramAccount.prototype, "isUpdates", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], TelegramAccount.prototype, "userId", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], TelegramAccount.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], TelegramAccount.prototype, "updatedAt", void 0);
//# sourceMappingURL=telegram_account.js.map