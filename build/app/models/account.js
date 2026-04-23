var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DateTime } from 'luxon';
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import User from '#models/user';
export default class Account extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Account.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Account.prototype, "userId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Account.prototype, "email", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], Account.prototype, "password", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Account.prototype, "provider", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Account.prototype, "autoAcceptOrders", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Account.prototype, "sessionStatus", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Account.prototype, "sessionError", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Account.prototype, "lastLoginAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Account.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Account.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => User),
    __metadata("design:type", Object)
], Account.prototype, "user", void 0);
//# sourceMappingURL=account.js.map