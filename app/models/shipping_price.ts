import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import Account from '#models/account'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ShippingPrice extends BaseModel {
  public static table = 'shipping_prices'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accountId: number

  @column()
  declare subSubCategoryId: number

  @column()
  declare imagePath: string

  @column()
  declare prices: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}