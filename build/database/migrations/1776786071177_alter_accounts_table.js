import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'accounts';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.boolean('auto_accept_orders').notNullable().defaultTo(true);
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('auto_accept_orders');
        });
    }
}
//# sourceMappingURL=1776786071177_alter_accounts_table.js.map