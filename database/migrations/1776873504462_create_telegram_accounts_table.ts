import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'telegram_accounts'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.bigInteger('user_id').notNullable().unique()
      table.boolean('is_updates').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

//https://api.telegram.org/bot8783621969:AAG70O-CIBZ2G95Mr40yybFZI4wypeQo_Wk/setWebhook?url=https://germicide-eaten-pep.ngrok-free.dev/telegram/webhook
//https://api.telegram.org/bot8783621969:AAG70O-CIBZ2G95Mr40yybFZI4wypeQo_Wk/deleteWebhook
