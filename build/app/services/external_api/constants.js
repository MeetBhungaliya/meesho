export const SESSION_COOKIE_KEYS = {
    identifier: 'current_az_identifier',
    sid: 'connect.sid',
};
export const SESSION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    FAILED: 'failed',
    EXPIRED: 'expired',
};
export const CACHE_PREFIX = {
    session: 'session:',
    supplier: 'supplier:',
};
export const MEESHO_BASE_URL = 'https://supplier.meesho.com';
export const MEESHO_ENDPOINTS = {
    login: `${MEESHO_BASE_URL}/api/container/user/v2-login`,
    prefetchSupplyData: `${MEESHO_BASE_URL}/api/container/supplier/prefetch-supply-data`,
    orders: `${MEESHO_BASE_URL}/api/fulfillment/orders`,
    requestPendingOrders: `${MEESHO_BASE_URL}/api/fulfillment/orders/reqPendingOrders`,
    fetchPendingOrdersHistory: `${MEESHO_BASE_URL}/api/fulfillment/orders/fetchPendingOrdersHistory`,
    updatePendingOrderStatus: `${MEESHO_BASE_URL}/api/fulfillment/orders/updatePendingOrderStatus`,
};
export const ORDER_STATUS = {
    PENDING: 1,
    ACCEPTED: 3,
};
export const ORDER_TYPE = {
    PENDING: 'pending',
};
export const SHIPMENT_TYPE = {
    FORWARD: 'forward',
};
export const POPUP_STATUS = {
    CLOSED: 'POPUP_CLOSED',
};
export const ORDER_LIMITS = {
    FETCH_LIMIT: 50,
    MAX_TRANSITIONS: 2000,
};
export const POLLING_CONFIG = {
    DELAY: '5s',
    MAX_ATTEMPTS: 20,
    PROGRESS_COMPLETE: 100,
};
export const REDIS_KEYS = {
    accountOrders: (accountId, date) => `orders:accepted:${accountId}:${date}`,
    userOrders: (userId, date) => `orders:accepted:user:${userId}:${date}`,
};
export const REDIS_TTL = {
    ORDER_TRACKING: 60 * 60 * 48,
};
export const TIMEZONE = 'Asia/Kolkata';
//# sourceMappingURL=constants.js.map