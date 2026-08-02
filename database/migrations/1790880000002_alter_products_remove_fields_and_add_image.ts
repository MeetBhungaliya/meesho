import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop unique constraints and indexes first
      table.dropUnique(['user_id', 'sku'])
      table.dropIndex(['user_id', 'category'])

      // Drop unused columns
      table.dropColumn('sku')
      table.dropColumn('category')
      table.dropColumn('reorder_point')

      // Add image path column
      table.string('image_path', 511).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('sku', 100).notNullable().defaultTo('')
      table.string('category', 255).nullable()
      table.integer('reorder_point').notNullable().defaultTo(0)
      table.dropColumn('image_path')

      table.unique(['user_id', 'sku'])
      table.index(['user_id', 'category'])
    })
  }
}
