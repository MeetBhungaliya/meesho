import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import MeeshoLabelJob from '#models/meesho_label_job'

export type MeeshoScheduleRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export default class MeeshoLabelScheduleRun extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare scheduleId: number

  @column.dateTime()
  declare scheduledFor: DateTime

  @column()
  declare jobId: string | null

  @column()
  declare status: MeeshoScheduleRunStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @belongsTo(() => MeeshoLabelSchedule, { foreignKey: 'scheduleId' })
  declare schedule: BelongsTo<typeof MeeshoLabelSchedule>

  @belongsTo(() => MeeshoLabelJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof MeeshoLabelJob>
}
