import { TelegramAccountSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class TelegramAccount extends TelegramAccountSchema {
  public static table = 'telegram_accounts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare isUpdates: boolean

  @column()
  declare userId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
