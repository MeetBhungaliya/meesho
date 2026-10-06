import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ads_sync_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // UUID uniquely identifies this sync run across all workers/processes
      table.uuid('sync_run_id').notNullable().unique()

      table
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      // RUNNING | SUCCESS | FAILED
      table.string('status', 20).notNullable().defaultTo('RUNNING')

      // Pagination progress
      table.integer('total_pages').defaultTo(0)
      table.integer('pages_processed').defaultTo(0)

      // Record-level counters
      table.integer('total_records').defaultTo(0)
      table.integer('processed_records').defaultTo(0)
      table.integer('failed_records').defaultTo(0)

      // Error details for debugging
      table.text('error_message').nullable()

      table.timestamp('started_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('completed_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    // Fast lookup of recent sync runs per account
    this.schema.raw(
      'CREATE INDEX idx_ads_sync_runs_account_status ON ads_sync_runs(account_id, status)'
    )
    this.schema.raw('CREATE INDEX idx_ads_sync_runs_started_at ON ads_sync_runs(started_at DESC)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
