export type AccountId = string

export interface SessionData {
  cookies: string
  expiry: number
}

export interface SupplierCacheData {
  id: number
  email: string
  phone: string
  supplierId: number
  name: string
  identifier: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  retries?: number
  skipAuth?: boolean
}

export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
}

export interface MeeshoSubOrder {
  grouping_key: string
}

export interface MeeshoOrderGroup {
  grouping_key: string
  sub_order_ids: string[]
  shipment_type: string
}

export interface MeeshoOrdersResponse {
  total_count: number
  data: {
    subOrders: MeeshoSubOrder[]
  }
}

export interface MeeshoAcceptOrdersResponse {
  request_id: string
}

export interface MeeshoOrderHistoryItem {
  request_id: string
  progress_percent: number
  processed_orders_count: number
}

export interface MeeshoOrderHistoryResponse {
  data: MeeshoOrderHistoryItem[]
}

export interface MeeshoUpdateStatusResponse {
  success: boolean
}

export interface MeeshoSupplierPrefetchResponse {
  user: {
    id: number
    email: string
    mobile_number: string
  }
  supplier: {
    supplier_id: number
    name: string
    identifier: string
  }
}

export interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

export interface TelegramSendOptions {
  parse_mode?: 'Markdown' | 'HTML'
  disable_notification?: boolean
}
