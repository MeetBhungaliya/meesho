import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Account from '#models/account'

export default class AdAccountConfig extends BaseModel {
  static table = 'ad_account_configs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accountId: number

  @column()
  declare apiUrl: string

  @column({
    prepare: (value: Record<string, unknown>) => JSON.stringify(value),
    consume: (value: string | Record<string, unknown>) =>
      typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare payload: Record<string, unknown>

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare dynamicFields: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}
