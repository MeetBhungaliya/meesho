import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import AdLaunchJob from '#jobs/ad_launch'

export default class AdvertisementsController {
  async submit({ request, response }: HttpContext) {
    const payload = request.only([
      'accountId',
      'catalogIds',
      'startTime',
      'endTime',
      'dynamicFieldValues',
      'jobId',
    ])

    const {
      accountId,
      catalogIds,
      startTime,
      endTime,
      dynamicFieldValues,
      jobId: clientJobId,
    } = payload

    if (!accountId || !catalogIds) {
      return response.badRequest({ message: 'Missing required fields' })
    }

    const parsedCatalogIds = Array.isArray(catalogIds)
      ? catalogIds.map(String)
      : typeof catalogIds === 'string'
        ? catalogIds
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : []

    if (parsedCatalogIds.length === 0) {
      return response.badRequest({ message: 'catalogIds cannot be empty' })
    }

    const jobId = clientJobId ? String(clientJobId) : randomUUID()

    await AdLaunchJob.dispatch({
      jobId,
      accountId: String(accountId),
      catalogIds: parsedCatalogIds,
      startTime,
      endTime,
      dynamicFieldValues: dynamicFieldValues || {},
    })

    return response.ok({
      message: 'Ad launch job queued successfully',
      jobId,
      total: parsedCatalogIds.length,
    })
  }

  async retry({ request, response }: HttpContext) {
    const payload = request.only([
      'accountId',
      'catalogIds',
      'startTime',
      'endTime',
      'dynamicFieldValues',
      'jobId',
    ])

    const {
      accountId,
      catalogIds,
      startTime,
      endTime,
      dynamicFieldValues,
      jobId: clientJobId,
    } = payload

    if (!accountId || !catalogIds) {
      return response.badRequest({ message: 'Missing required fields' })
    }

    const parsedCatalogIds = Array.isArray(catalogIds) ? catalogIds.map(String) : []

    if (parsedCatalogIds.length === 0) {
      return response.badRequest({ message: 'catalogIds cannot be empty for retry' })
    }

    const jobId = clientJobId ? String(clientJobId) : randomUUID()

    await AdLaunchJob.dispatch({
      jobId,
      accountId: String(accountId),
      catalogIds: parsedCatalogIds,
      startTime,
      endTime,
      dynamicFieldValues: dynamicFieldValues || {},
    })

    return response.ok({
      message: 'Retry ad launch job queued successfully',
      jobId,
      total: parsedCatalogIds.length,
    })
  }
}
