import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Account from '#models/account'

export const ADS_SYNC_RUN_STATUS = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const

export type AdsSyncRunStatus = (typeof ADS_SYNC_RUN_STATUS)[keyof typeof ADS_SYNC_RUN_STATUS]

export default class AdsSyncRun extends BaseModel {
  static table = 'ads_sync_runs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare syncRunId: string

  @column()
  declare accountId: number

  @column()
  declare status: AdsSyncRunStatus

  @column()
  declare totalPages: number

  @column()
  declare pagesProcessed: number

  @column()
  declare totalRecords: number

  @column()
  declare processedRecords: number

  @column()
  declare failedRecords: number

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}
