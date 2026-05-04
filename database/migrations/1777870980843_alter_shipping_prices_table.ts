import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shipping_prices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('meesho_image_url').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('meesho_image_url')
    })
  }
}
