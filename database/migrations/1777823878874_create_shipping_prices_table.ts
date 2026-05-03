import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
 protected tableName = 'shipping_prices'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('account_id').notNullable()
      table.integer('sub_sub_category_id').notNullable()
      table.string('image_path').notNullable()
      table.integer('prices').nullable()
      table.timestamps(true)
      
      table.foreign('account_id').references('id').inTable('accounts').onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}