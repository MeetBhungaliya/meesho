import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('name', 255).notNullable()
      table.string('sku', 100).notNullable()
      table.string('category', 255).nullable()
      table.decimal('price', 10, 2).notNullable().defaultTo(0)
      table.integer('current_stock').notNullable().defaultTo(0)
      table.integer('minimum_stock').notNullable().defaultTo(0)
      table.integer('reorder_point').notNullable().defaultTo(0)
      table.text('note').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.unique(['user_id', 'sku'])
      table.index(['user_id', 'is_active'])
      table.index(['user_id', 'category'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
