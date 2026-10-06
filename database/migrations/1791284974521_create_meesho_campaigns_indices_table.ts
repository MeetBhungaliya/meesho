import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meesho_campaigns'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Indexes to support cursor pagination (ORDER BY col DESC, id DESC)
      table.index(['roi', 'id'])
      table.index(['revenue', 'id'])
      table.index(['total_budget', 'id'])
      table.index(['budget_utilised', 'id'])
      table.index(['total_views', 'id'])
      table.index(['total_clicks', 'id'])
      table.index(['order_count', 'id'])
      table.index(['campaign_name', 'id'])

      // Index for the ILIKE searches or basic string filters
      table.index(['campaign_id'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['roi', 'id'])
      table.dropIndex(['revenue', 'id'])
      table.dropIndex(['total_budget', 'id'])
      table.dropIndex(['budget_utilised', 'id'])
      table.dropIndex(['total_views', 'id'])
      table.dropIndex(['total_clicks', 'id'])
      table.dropIndex(['order_count', 'id'])
      table.dropIndex(['campaign_name', 'id'])

      table.dropIndex(['campaign_id'])
      table.dropIndex(['status'])
    })
  }
}
