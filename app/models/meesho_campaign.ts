import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Account from '#models/account'

export const SYNC_STATUS = {
  PRESENT: 'PRESENT',
  MISSING: 'MISSING',
} as const

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

export default class MeeshoCampaign extends BaseModel {
  static table = 'meesho_campaigns'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accountId: number

  @column()
  declare campaignId: number

  @column()
  declare campaignName: string

  @column.dateTime()
  declare startDate: DateTime | null

  @column()
  declare tillBudgetLasts: boolean

  @column()
  declare totalBudget: number

  @column()
  declare budgetType: string | null

  @column()
  declare campaignType: string | null

  @column()
  declare catalogId: number | null

  @column()
  declare catalogCount: number

  /** Campaign status from Meesho: LIVE / PAUSED / UPCOMING */
  @column()
  declare status: string

  @column()
  declare isSmartCampaign: boolean

  @column()
  declare isSmartCampaignRestartAllowed: boolean

  @column()
  declare vgFlag: boolean

  @column()
  declare bidType: string | null

  @column()
  declare isGmvMaxSmartCampaign: boolean

  @column()
  declare derivedBidType: string | null

  @column()
  declare campaignSrc: string | null

  @column()
  declare isMigrating: boolean

  // Performance metrics (denormalized for fast query)
  @column()
  declare budgetUtilised: number

  @column()
  declare cpc: number

  @column()
  declare revenue: number

  @column()
  declare orderCount: number

  @column()
  declare roi: number

  @column()
  declare totalViews: number

  @column()
  declare conversionRate: number

  @column()
  declare totalClicks: number

  /** PRESENT = campaign visible in Meesho API; MISSING = disappeared */
  @column()
  declare syncStatus: SyncStatus

  /** UUID of the last sync run that observed this campaign */
  @column()
  declare lastSeenSyncId: string | null

  @column.dateTime()
  declare lastSeenAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}
