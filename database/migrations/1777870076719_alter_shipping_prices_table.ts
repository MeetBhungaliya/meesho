import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shipping_prices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('batch_name').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('batch_name')
    })
  }
}
