import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import Account from '#models/account'

export type MeeshoLabelDocumentStatus = 'PROCESSED' | 'FAILED'

export default class MeeshoLabelDocument extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare jobId: string

  @column()
  declare jobAccountId: number

  @column()
  declare accountId: number

  @column()
  declare sku: string | null

  @column()
  declare orderId: string | null

  @column()
  declare subOrderId: string | null

  @column()
  declare awb: string | null

  @column()
  declare quantity: number

  @column()
  declare size: string | null

  @column()
  declare color: string | null

  @column()
  declare sourcePageNumber: number

  @column()
  declare processedPageNumber: number | null

  @column()
  declare rawPdfS3Key: string | null

  @column()
  declare processedPdfS3Key: string | null

  @column()
  declare status: MeeshoLabelDocumentStatus

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => MeeshoLabelJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof MeeshoLabelJob>

  @belongsTo(() => MeeshoLabelJobAccount, { foreignKey: 'jobAccountId' })
  declare jobAccount: BelongsTo<typeof MeeshoLabelJobAccount>

  @belongsTo(() => Account, { foreignKey: 'accountId' })
  declare account: BelongsTo<typeof Account>
}
