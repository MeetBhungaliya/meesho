import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_campaigns'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      // Meesho campaign identity
      table.bigInteger('campaign_id').notNullable()
      table.text('campaign_name').notNullable().defaultTo('')

      // Campaign configuration
      table.timestamp('start_date', { useTz: true }).nullable()
      table.boolean('till_budget_lasts').defaultTo(false)
      table.decimal('total_budget', 12, 2).defaultTo(0)
      table.string('budget_type', 50).nullable()
      table.string('campaign_type', 50).nullable()
      table.bigInteger('catalog_id').nullable()
      table.integer('catalog_count').defaultTo(0)

      // Campaign status from Meesho (LIVE / PAUSED / UPCOMING)
      table.string('status', 30).notNullable().defaultTo('LIVE')

      // Campaign flags
      table.boolean('is_smart_campaign').defaultTo(false)
      table.boolean('is_smart_campaign_restart_allowed').defaultTo(false)
      table.boolean('vg_flag').defaultTo(false)
      table.string('bid_type', 50).nullable()
      table.boolean('is_gmv_max_smart_campaign').defaultTo(false)
      table.string('derived_bid_type', 50).nullable()
      table.string('campaign_src', 50).nullable()
      table.boolean('is_migrating').defaultTo(false)

      // Performance fields (denormalized from perf_details for fast filtering/sorting)
      table.decimal('budget_utilised', 12, 2).defaultTo(0)
      table.decimal('cpc', 10, 4).defaultTo(0)
      table.decimal('revenue', 12, 2).defaultTo(0)
      table.integer('order_count').defaultTo(0)
      table.decimal('roi', 10, 4).defaultTo(0)
      table.bigInteger('total_views').defaultTo(0)
      table.decimal('conversion_rate', 10, 6).defaultTo(0)
      table.bigInteger('total_clicks').defaultTo(0)

      // Sync visibility (PRESENT = visible in Meesho, MISSING = disappeared from API)
      table.string('sync_status', 20).notNullable().defaultTo('PRESENT')
      // UUID of the last successful sync run that observed this campaign
      table.string('last_seen_sync_id', 36).nullable()
      table.timestamp('last_seen_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Enforce uniqueness: campaign_id is unique within an account
      table.unique(['account_id', 'campaign_id'])
    })

    // Primary admin UI read path
    this.schema.raw(
      'CREATE INDEX idx_meesho_campaigns_account_sync ON meesho_campaigns(account_id, sync_status)'
    )
    // Filtering & sorting indexes
    this.schema.raw('CREATE INDEX idx_meesho_campaigns_status ON meesho_campaigns(status)')
    this.schema.raw(
      'CREATE INDEX idx_meesho_campaigns_campaign_type ON meesho_campaigns(campaign_type)'
    )
    this.schema.raw('CREATE INDEX idx_meesho_campaigns_roi ON meesho_campaigns(roi)')
    this.schema.raw('CREATE INDEX idx_meesho_campaigns_start_date ON meesho_campaigns(start_date)')
    this.schema.raw(
      'CREATE INDEX idx_meesho_campaigns_total_views ON meesho_campaigns(total_views)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
