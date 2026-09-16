/** Meesho returns this non-standard status code when the supplier session has expired. */
export const MEESHO_SESSION_EXPIRED_STATUS = 463

export const SESSION_COOKIE_KEYS = {
  identifier: 'current_az_identifier',
  sid: 'connect.sid',
} as const

export const API_HEADERS = {
  'Content-Type': 'application/json',
  'client-type': 'd-web',
  'Accept': '*/*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
  adsCampaigns: 'ads:campaigns:',
} as const

export const MEESHO_BASE_URL = 'https://supplier.meesho.com'

export const MEESHO_ENDPOINTS = {
  login: `${MEESHO_BASE_URL}/api/container/user/v2-login`,
  prefetchSupplyData: `${MEESHO_BASE_URL}/api/container/supplier/prefetch-supply-data`,
  orders: `${MEESHO_BASE_URL}/api/fulfillment/orders`,
  requestPendingOrders: `${MEESHO_BASE_URL}/api/fulfillment/orders/reqPendingOrders`,
  fetchPendingOrdersHistory: `${MEESHO_BASE_URL}/api/fulfillment/orders/fetchPendingOrdersHistory`,
  updatePendingOrderStatus: `${MEESHO_BASE_URL}/api/fulfillment/orders/updatePendingOrderStatus`,
  uploadSingleCatalogImages: `${MEESHO_BASE_URL}/api/cataloging/singleCatalogUpload/uploadSingleCatalogImages`,
  fetchDuplicatePid: `${MEESHO_BASE_URL}/api/cataloging/priceRecommendation/fetchDuplicatePid`,
  reqDownloadLabelV2: `${MEESHO_BASE_URL}/api/fulfillment/orders/reqDownloadLabelV2`,
  fetchLabelDownloadHistory: `${MEESHO_BASE_URL}/api/fulfillment/orders/fetchLabelDownloadHistory`,
  updateGroupDownloadBackendFlag: `${MEESHO_BASE_URL}/api/fulfillment/orders/updateGroupDownloadBackendFlag`,
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

export const LABEL_ERROR_CODES = {
  MEESHO_API_TIMEOUT: 'MEESHO_API_TIMEOUT',
  MEESHO_API_RATE_LIMIT: 'MEESHO_API_RATE_LIMIT',
  MEESHO_API_AUTH_FAILED: 'MEESHO_API_AUTH_FAILED',
  MEESHO_REQUEST_FAILED: 'MEESHO_REQUEST_FAILED',
  MEESHO_REQUEST_ID_NOT_FOUND: 'MEESHO_REQUEST_ID_NOT_FOUND',
  MEESHO_LABEL_PROCESSING_FAILED: 'MEESHO_LABEL_PROCESSING_FAILED',
  MEESHO_LABEL_URL_MISSING: 'MEESHO_LABEL_URL_MISSING',
  PDF_DOWNLOAD_FAILED: 'PDF_DOWNLOAD_FAILED',
  PDF_INVALID: 'PDF_INVALID',
  PDF_TEMPLATE_NOT_RECOGNIZED: 'PDF_TEMPLATE_NOT_RECOGNIZED',
  SKU_NOT_FOUND: 'SKU_NOT_FOUND',
  AWB_NOT_FOUND: 'AWB_NOT_FOUND',
  PDF_CROP_FAILED: 'PDF_CROP_FAILED',
  PDF_MERGE_FAILED: 'PDF_MERGE_FAILED',
  S3_UPLOAD_FAILED: 'S3_UPLOAD_FAILED',
  SCHEDULE_INVALID: 'SCHEDULE_INVALID',
  SCHEDULE_EXECUTION_FAILED: 'SCHEDULE_EXECUTION_FAILED',
  ACCOUNTS_NOT_FOUND: 'ACCOUNTS_NOT_FOUND',
} as const

export type LabelErrorCode = (typeof LABEL_ERROR_CODES)[keyof typeof LABEL_ERROR_CODES]
