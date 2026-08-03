import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ad_account_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      table.string('api_url', 2048).notNullable()
      table.jsonb('payload').notNullable()
      table.jsonb('dynamic_fields').notNullable().defaultTo('[]')

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // One config per account — enforced at DB level
      table.unique(['account_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
