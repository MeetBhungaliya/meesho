import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Account from '#models/account'
import MeeshoLabelScheduleRun from '#models/meesho_label_schedule_run'

export type MeeshoScheduleFrequency = 'daily' | 'weekly' | 'custom_cron'

export default class MeeshoLabelSchedule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string

  @column()
  declare timezone: string

  @column()
  declare frequency: MeeshoScheduleFrequency

  @column()
  declare runTime: string // 'HH:mm'

  @column({
    prepare: (value: number[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | number[] | null) => {
      if (!value) return null
      return typeof value === 'string' ? JSON.parse(value) : value
    },
  })
  declare daysOfWeek: number[] | null

  @column()
  declare cronExpression: string | null

  @column()
  declare enabled: boolean

  @column.dateTime()
  declare nextRunAt: DateTime | null

  @column.dateTime()
  declare lastRunAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Account, {
    pivotTable: 'meesho_label_schedule_accounts',
    pivotForeignKey: 'schedule_id',
    pivotRelatedForeignKey: 'account_id',
  })
  declare accounts: ManyToMany<typeof Account>

  @hasMany(() => MeeshoLabelScheduleRun, { foreignKey: 'scheduleId' })
  declare runs: HasMany<typeof MeeshoLabelScheduleRun>
}
