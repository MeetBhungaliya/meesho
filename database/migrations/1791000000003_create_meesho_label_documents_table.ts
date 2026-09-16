import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_label_documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .uuid('job_id')
        .notNullable()
        .references('id')
        .inTable('meesho_label_jobs')
        .onDelete('CASCADE')

      table
        .integer('job_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('meesho_label_job_accounts')
        .onDelete('CASCADE')

      table
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      table.string('sku', 255).nullable()
      table.string('order_id', 255).nullable()
      table.string('sub_order_id', 255).nullable()
      table.string('awb', 255).nullable()
      table.integer('quantity').defaultTo(1)
      table.string('size', 128).nullable()
      table.string('color', 128).nullable()

      table.integer('source_page_number').notNullable()
      table.integer('processed_page_number').nullable()

      table.string('raw_pdf_s3_key', 1024).nullable()
      table.string('processed_pdf_s3_key', 1024).nullable()

      table.string('status', 32).notNullable().defaultTo('PROCESSED') // 'PROCESSED' | 'FAILED'
      table.string('error_code', 64).nullable()
      table.text('error_message').nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('processed_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.index(['job_id'])
      table.index(['job_account_id'])
      table.index(['sku'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
