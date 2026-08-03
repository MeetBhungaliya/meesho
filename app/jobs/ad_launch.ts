import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import transmit from '@adonisjs/transmit/services/main'
import AdAccountConfig from '#models/ad_account_config'
import Account from '#models/account'
import { SessionManager } from '#services/external_api/session_manager'
import { MeeshoApiClient } from '#services/external_api/client'
import { DateTime } from 'luxon'

export interface AdLaunchPayload {
  jobId: string
  accountId: string
  catalogIds: string[]
  startTime?: string
  endTime?: string
  dynamicFieldValues: Record<string, string>
}

interface FailedItem {
  [key: string]: any
  catalogId: string
  reason: string
}

export default class AdLaunchJob extends Job<AdLaunchPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 1, // Manual retries preferred
  }

  async execute() {
    const { jobId, accountId, catalogIds, startTime, endTime, dynamicFieldValues } = this.payload

    console.log(`ad-launch:${jobId} starting...`)
    transmit.broadcast(`ad-launch:${jobId}`, {
      type: 'started',
      total: catalogIds.length,
    })

    const account = await Account.query().where('id', accountId).first()
    if (!account) {
      throw new Error(`Account not found for id ${accountId}`)
    }

    const config = await AdAccountConfig.query().where('account_id', account.id).first()
    if (!config) {
      throw new Error(`Advertisement configuration not found for account ${accountId}`)
    }

    const supplierData = await SessionManager.getSupplierData(account.id.toString())
    const supplierId = supplierData?.supplierId || ''

    const client = await MeeshoApiClient.forAccount(account.id.toString())

    let successCount = 0
    let failedCount = 0
    const failedItems: FailedItem[] = []

    for (let i = 0; i < catalogIds.length; i++) {
      const catalogId = catalogIds[i].toString().trim()
      if (!catalogId) continue

      try {
        // Construct the payload for this catalog
        const finalPayload = JSON.parse(JSON.stringify(config.payload))
        const todayStr = DateTime.now().toFormat('dd/MM/yyyy')

        // 1. Set supplier_id
        finalPayload.supplier_id = Number(supplierId) || supplierId

        // 2. Set start_time and end_time
        if (startTime) finalPayload.start_time = startTime
        if (endTime) finalPayload.end_time = endTime
        else if (finalPayload.end_time === undefined) finalPayload.end_time = null

        // 3. Auto generate campaign_name (outer)
        if ('campaign_name' in finalPayload) {
          finalPayload.campaign_name = `${supplierId} - ${todayStr}`
        }

        // 4. Expand catalogs array for this specific catalog ID
        if (Array.isArray(finalPayload.catalogs) && finalPayload.catalogs.length > 0) {
          const template = finalPayload.catalogs[0]
          const catalogItem: any = {
            ...template,
            catalog_id: Number(catalogId) || catalogId,
          }

          // Auto generate campaign_name (inside catalog item)
          if ('campaign_name' in template) {
            catalogItem.campaign_name = `${catalogId}_${todayStr}`
          }

          finalPayload.catalogs = [catalogItem]
        } else if (!finalPayload.catalogs) {
          finalPayload.catalogs = [
            {
              catalog_id: Number(catalogId) || catalogId,
            },
          ]
        }

        // 4. Apply dynamic fields
        for (const [fieldPath, value] of Object.entries(dynamicFieldValues)) {
          const parsedValue =
            !Number.isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value

          if (fieldPath.includes('[]')) {
            const [arrayPath, itemPath] = fieldPath.split('[].')
            const arr = arrayPath
              .split('.')
              .reduce((acc: any, key: string) => acc?.[key], finalPayload)

            if (Array.isArray(arr)) {
              arr.forEach((item: any) => {
                if (!itemPath) return
                const itemKeys = itemPath.split('.')
                let target = item
                for (let j = 0; j < itemKeys.length - 1; j++) {
                  if (!target[itemKeys[j]]) target[itemKeys[j]] = {}
                  target = target[itemKeys[j]]
                }
                target[itemKeys[itemKeys.length - 1]] = parsedValue
              })
            }
          } else {
            const keys = fieldPath.split('.')
            let target = finalPayload
            for (let j = 0; j < keys.length - 1; j++) {
              if (!target[keys[j]]) target[keys[j]] = {}
              target = target[keys[j]]
            }
            target[keys[keys.length - 1]] = parsedValue
          }
        }

        // Execute API call
        await client.post(config.apiUrl, finalPayload)

        successCount++
        transmit.broadcast(`ad-launch:${jobId}`, {
          type: 'progress',
          processed: i + 1,
          total: catalogIds.length,
          catalogId,
          status: 'success',
        })
      } catch (error) {
        failedCount++
        const reason = (error as Error).message
        failedItems.push({ catalogId, reason })

        transmit.broadcast(`ad-launch:${jobId}`, {
          type: 'progress',
          processed: i + 1,
          total: catalogIds.length,
          catalogId,
          status: 'failed',
          error: reason,
        })
      }

      // Minor delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    transmit.broadcast(`ad-launch:${jobId}`, {
      type: 'completed',
      successCount,
      failedCount,
      failedItems,
    })
  }

  async failed(error: Error) {
    console.error('AdLaunchJob failed:', error.message)
    transmit.broadcast(`ad-launch:${this.payload.jobId}`, {
      type: 'error',
      message: 'Job encountered an unrecoverable error: ' + error.message,
    })
  }
}
