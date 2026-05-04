import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shipping_prices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_processed').notNullable().defaultTo(false)
      table.string('error_message').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_processed')
      table.dropColumn('error_message')
    })
  }
}
