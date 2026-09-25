import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import MeeshoLabelDocument from '#models/meesho_label_document'

export type MeeshoLabelJobType = 'manual' | 'scheduled'

export type MeeshoLabelJobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED'

export default class MeeshoLabelJob extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number

  @column()
  declare type: MeeshoLabelJobType

  @column()
  declare status: MeeshoLabelJobStatus

  @column()
  declare totalAccounts: number

  @column()
  declare completedAccounts: number

  @column()
  declare failedAccounts: number

  @column()
  declare totalLabels: number

  @column()
  declare processedLabels: number

  @column()
  declare failedLabels: number

  @column({ columnName: 'final_pdf_s3_key' })
  declare finalPdfS3Key: string | null

  @column()
  declare finalPdfSize: number | null

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => MeeshoLabelJobAccount, { foreignKey: 'jobId' })
  declare accounts: HasMany<typeof MeeshoLabelJobAccount>

  @hasMany(() => MeeshoLabelDocument, { foreignKey: 'jobId' })
  declare documents: HasMany<typeof MeeshoLabelDocument>
}
