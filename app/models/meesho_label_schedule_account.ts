import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import Account from '#models/account'

export default class MeeshoLabelScheduleAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare scheduleId: number

  @column()
  declare accountId: number

  @belongsTo(() => MeeshoLabelSchedule, { foreignKey: 'scheduleId' })
  declare schedule: BelongsTo<typeof MeeshoLabelSchedule>

  @belongsTo(() => Account, { foreignKey: 'accountId' })
  declare account: BelongsTo<typeof Account>
}
