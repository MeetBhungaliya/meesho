import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_label_job_accounts'

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
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      table.string('supplier_id', 128).nullable()
      table.string('identifier', 128).nullable()
      table.string('supplier_name', 255).nullable()

      table.string('status', 32).notNullable().defaultTo('PENDING')
      table.string('meesho_request_id', 255).nullable()

      table.integer('total_suborders').defaultTo(0)
      table.integer('successful_suborders').defaultTo(0)
      table.integer('progress_percent').defaultTo(0)

      table.string('raw_pdf_s3_key', 1024).nullable()
      table.string('processed_pdf_s3_key', 1024).nullable()

      table.string('error_code', 64).nullable()
      table.text('error_message').nullable()
      table.integer('attempt_count').defaultTo(0)

      table.timestamp('requested_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.index(['job_id'])
      table.index(['account_id'])
      table.index(['meesho_request_id'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
