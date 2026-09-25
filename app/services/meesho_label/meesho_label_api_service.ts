import { MeeshoApiClient } from '#services/external_api/client'
import { MEESHO_ENDPOINTS } from '#services/external_api/constants'
import { MeeshoRequestQueue } from '#services/external_api/meesho_request_queue'
import type { SupplierCacheData } from '#services/external_api/types'

export interface MeeshoReqDownloadLabelPayload {
  [key: string]: unknown
  supplier_details: {
    id: number
    identifier: string
    name: string
  }
  identifier: string
  enable_hold: boolean
  include_all: boolean
  current_status: number
  requested_status: number
  max_transitions: number
  filter: Record<string, unknown>
  child_supplier_identifier: string | null
  child_supplier_id: number | null
}

export interface MeeshoReqDownloadLabelResponse {
  request_id: string
}

export interface MeeshoLabelHistoryItem {
  request_id: string
  status_message?: string
  status: string
  requested_at_msg?: string
  error_message?: string
  success_suborder_count?: number
  total_suborder_count?: number
  progress_percent?: number
  label_url?: string
}

export interface MeeshoLabelHistoryResponse {
  data?: MeeshoLabelHistoryItem[]
  is_polling?: boolean
  polling_time_ms?: number
}

export class MeeshoLabelApiService {
  /**
   * Builds the exact payload required by Meesho for reqDownloadLabelV2
   */
  static buildDownloadLabelPayload(
    supplier: SupplierCacheData,
    options: {
      filter?: Record<string, unknown>
      maxTransitions?: number
    } = {}
  ): MeeshoReqDownloadLabelPayload {
    return {
      supplier_details: {
        id: Number(supplier.supplierId),
        identifier: supplier.identifier,
        name: supplier.name,
      },
      identifier: supplier.identifier,
      enable_hold: true,
      include_all: true,
      current_status: 1,
      requested_status: 101,
      max_transitions: options.maxTransitions ?? 1996,
      filter: options.filter ?? {
        label_downloaded: {
          status: false,
        },
      },
      child_supplier_identifier: null,
      child_supplier_id: null,
    }
  }

  /**
   * Request label generation from Meesho for a specific account.
   */
  static async requestLabelDownload(
    accountId: string,
    options?: { filter?: Record<string, unknown> }
  ): Promise<{ requestId: string; supplier: SupplierCacheData }> {
    const client = await MeeshoApiClient.forAccount(accountId)
    const payload = this.buildDownloadLabelPayload(client.supplier, options)

    const response = await MeeshoRequestQueue.enqueue(async () => {
      return client.post<MeeshoReqDownloadLabelResponse>(
        MEESHO_ENDPOINTS.reqDownloadLabelV2,
        payload
      )
    })

    if (!response.data?.request_id) {
      throw new Error(`Meesho did not return a request_id for account ${accountId}`)
    }

    return {
      requestId: response.data.request_id,
      supplier: client.supplier,
    }
  }

  /**
   * Fetch label download history for a specific account.
   */
  static async fetchLabelDownloadHistory(accountId: string): Promise<MeeshoLabelHistoryResponse> {
    const client = await MeeshoApiClient.forAccount(accountId)
    const payload = {
      supplier_id: Number(client.supplier.supplierId),
      identifier: client.supplier.identifier,
      child_supplier_identifier: null,
      child_supplier_id: null,
    }

    const response = await MeeshoRequestQueue.enqueue(async () => {
      return client.post<MeeshoLabelHistoryResponse>(
        MEESHO_ENDPOINTS.fetchLabelDownloadHistory,
        payload
      )
    })

    return response.data
  }

  /**
   * Strictly matches the target request_id in the history response.
   * Never simply takes index 0.
   */
  static findRequestInHistory(
    history: MeeshoLabelHistoryResponse,
    requestId: string
  ): MeeshoLabelHistoryItem | undefined {
    if (!history?.data || !Array.isArray(history.data)) {
      return undefined
    }

    return history.data.find((item) => item.request_id === requestId)
  }

  /**
   * Updates Meesho backend flag after successful label download:
   * POST https://supplier.meesho.com/api/fulfillment/orders/updateGroupDownloadBackendFlag
   */
  static async updateGroupDownloadBackendFlag(accountId: string, requestId: string): Promise<void> {
    const client = await MeeshoApiClient.forAccount(accountId)
    const payload = {
      supplier_id: Number(client.supplier.supplierId),
      identifier: client.supplier.identifier,
      request_id: requestId,
      child_supplier_identifier: null,
      child_supplier_id: null,
    }

    await MeeshoRequestQueue.enqueue(async () => {
      return client.post(MEESHO_ENDPOINTS.updateGroupDownloadBackendFlag, payload)
    })
  }

  /**
   * Updates Meesho label download status (e.g. POPUP_CLOSED on failure or modal close):
   * POST https://supplier.meesho.com/api/fulfillment/orders/updateLabelDownloadStatus
   */
  static async updateLabelDownloadStatus(
    accountId: string,
    requestId: string,
    status: string = 'POPUP_CLOSED'
  ): Promise<void> {
    const client = await MeeshoApiClient.forAccount(accountId)
    const payload = {
      supplier_id: Number(client.supplier.supplierId),
      identifier: client.supplier.identifier,
      request_id: requestId,
      status,
      child_supplier_identifier: null,
      child_supplier_id: null,
    }

    await MeeshoRequestQueue.enqueue(async () => {
      return client.post(MEESHO_ENDPOINTS.updateLabelDownloadStatus, payload)
    })
  }
}
