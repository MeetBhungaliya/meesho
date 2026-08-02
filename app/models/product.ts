import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import StockTransaction from '#models/stock_transaction'

import env from '#start/env'

export default class Product extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string

  @column()
  declare price: number

  @column()
  declare currentStock: number

  @column()
  declare minimumStock: number

  @column()
  declare note: string | null

  @column()
  declare isActive: boolean

  @column()
  declare imagePath: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => StockTransaction)
  declare stockTransactions: HasMany<typeof StockTransaction>

  /**
   * Computed inventory value: price × currentStock
   */
  get inventoryValue(): number {
    return Number((this.price * this.currentStock).toFixed(2))
  }

  /**
   * Stock status based on thresholds
   */
  get stockStatus(): 'out_of_stock' | 'low_stock' | 'in_stock' {
    if (this.currentStock <= 0) return 'out_of_stock'
    if (this.currentStock <= this.minimumStock) return 'low_stock'
    return 'in_stock'
  }

  /**
   * Get public image URL
   */
  get imageUrl(): string | null {
    if (!this.imagePath) return null
    const disk = env.get('NODE_ENV') === 'development' ? 'fs' : env.get('DRIVE_DISK')
    if (disk === 's3') {
      return `https://${env.get('S3_BUCKET')}.s3.${env.get('AWS_REGION')}.amazonaws.com/${this.imagePath}`
    }
    return `/uploads/${this.imagePath}`
  }

  /**
   * Custom serialization to include computed properties
   */
  serialize() {
    return {
      ...super.serialize(),
      inventoryValue: this.inventoryValue,
      stockStatus: this.stockStatus,
      imageUrl: this.imageUrl,
    }
  }
}
