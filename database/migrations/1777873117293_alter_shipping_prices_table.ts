import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shipping_prices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('prices', 'price')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('price', 'prices')
    })
  }
}
