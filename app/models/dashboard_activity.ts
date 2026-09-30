import { DashboardActivitySchema } from '#database/schema'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class DashboardActivity extends DashboardActivitySchema {
  public static table = 'dashboard_activities'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare action: string

  @column()
  declare detail: string

  @column()
  declare type: string

  @column()
  declare read: boolean

  @column.dateTime()
  declare time: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
