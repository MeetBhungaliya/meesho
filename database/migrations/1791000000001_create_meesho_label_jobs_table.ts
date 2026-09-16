import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_label_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('type', 32).notNullable().defaultTo('manual') // 'manual' | 'scheduled'
      table.string('status', 32).notNullable().defaultTo('CREATED')
      table.integer('total_accounts').defaultTo(0)
      table.integer('completed_accounts').defaultTo(0)
      table.integer('failed_accounts').defaultTo(0)
      table.integer('total_labels').defaultTo(0)
      table.integer('processed_labels').defaultTo(0)
      table.integer('failed_labels').defaultTo(0)

      table.string('final_pdf_s3_key', 1024).nullable()
      table.integer('final_pdf_size').nullable()
      table.string('error_code', 64).nullable()
      table.text('error_message').nullable()

      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.index(['user_id', 'created_at'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
