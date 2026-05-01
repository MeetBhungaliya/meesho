export const SESSION_COOKIE_KEYS = {
  identifier: 'current_az_identifier',
  sid: 'connect.sid',
} as const

export const API_HEADERS = {
  'Content-Type': 'application/json',
  'client-type': 'd-web',
  'Accept': '*/*',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
} as const

export const SESSION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS]

export const CACHE_PREFIX = {
  session: 'session:',
  supplier: 'supplier:',
} as const

export const MEESHO_BASE_URL = 'https://supplier.meesho.com'

export const MEESHO_ENDPOINTS = {
  login: `${MEESHO_BASE_URL}/api/container/user/v2-login`,
  prefetchSupplyData: `${MEESHO_BASE_URL}/api/container/supplier/prefetch-supply-data`,
  orders: `${MEESHO_BASE_URL}/api/fulfillment/orders`,
  requestPendingOrders: `${MEESHO_BASE_URL}/api/fulfillment/orders/reqPendingOrders`,
  fetchPendingOrdersHistory: `${MEESHO_BASE_URL}/api/fulfillment/orders/fetchPendingOrdersHistory`,
  updatePendingOrderStatus: `${MEESHO_BASE_URL}/api/fulfillment/orders/updatePendingOrderStatus`,
} as const

export const ORDER_STATUS = {
  PENDING: 1,
  ACCEPTED: 3,
} as const

export const ORDER_TYPE = {
  PENDING: 'pending',
} as const

export const SHIPMENT_TYPE = {
  FORWARD: 'forward',
} as const

export const POPUP_STATUS = {
  CLOSED: 'POPUP_CLOSED',
} as const

export const ORDER_LIMITS = {
  FETCH_LIMIT: 50,
  MAX_TRANSITIONS: 2000,
} as const

export const POLLING_CONFIG = {
  DELAY: '5s',
  MAX_ATTEMPTS: 20,
  PROGRESS_COMPLETE: 100,
} as const

export const REDIS_KEYS = {
  accountOrders: (accountId: string, date: string) => `orders:accepted:${accountId}:${date}`,
} as const

export const REDIS_TTL = {
  ORDER_TRACKING: 60 * 60 * 48,
} as const

export const TIMEZONE = 'Asia/Kolkata' as const
