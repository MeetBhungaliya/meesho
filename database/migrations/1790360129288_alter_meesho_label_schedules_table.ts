import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_label_schedules'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('filter').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('filter')
    })
  }
}
