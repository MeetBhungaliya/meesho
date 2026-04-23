import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'accounts';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .enum('session_status', ['pending', 'active', 'failed', 'expired'])
                .notNullable()
                .defaultTo('pending');
            table.text('session_error').nullable();
            table.timestamp('last_login_at', { useTz: true }).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('session_status');
            table.dropColumn('session_error');
            table.dropColumn('last_login_at');
        });
    }
}
//# sourceMappingURL=1776772822000_add_session_status_to_accounts.js.map