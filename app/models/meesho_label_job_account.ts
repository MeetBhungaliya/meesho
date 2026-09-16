import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import MeeshoLabelJob from '#models/meesho_label_job'
import Account from '#models/account'
import MeeshoLabelDocument from '#models/meesho_label_document'

export type MeeshoLabelJobAccountStatus =
  | 'PENDING'
  | 'REQUESTING'
  | 'REQUESTED'
  | 'POLLING'
  | 'READY_FOR_DOWNLOAD'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'

export default class MeeshoLabelJobAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare jobId: string

  @column()
  declare accountId: number

  @column()
  declare supplierId: string | null

  @column()
  declare identifier: string | null

  @column()
  declare supplierName: string | null

  @column()
  declare status: MeeshoLabelJobAccountStatus

  @column()
  declare meeshoRequestId: string | null

  @column()
  declare totalSuborders: number

  @column()
  declare successfulSuborders: number

  @column()
  declare progressPercent: number

  @column()
  declare rawPdfS3Key: string | null

  @column()
  declare processedPdfS3Key: string | null

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column()
  declare attemptCount: number

  @column.dateTime()
  declare requestedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => MeeshoLabelJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof MeeshoLabelJob>

  @belongsTo(() => Account, { foreignKey: 'accountId' })
  declare account: BelongsTo<typeof Account>

  @hasMany(() => MeeshoLabelDocument, { foreignKey: 'jobAccountId' })
  declare documents: HasMany<typeof MeeshoLabelDocument>
}
