import { ApiError, SessionError } from '#services/external_api/errors';
import { SessionManager } from '#services/external_api/session_manager';
import Account from '#models/account';
const DEFAULT_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
export class MeeshoApiClient {
    accountId;
    sessionCookies;
    supplierData;
    constructor(accountId, sessionCookies, supplierData) {
        this.accountId = accountId;
        this.sessionCookies = sessionCookies;
        this.supplierData = supplierData;
    }
    static async forAccount(accountId) {
        let cookies = await SessionManager.getSession(accountId);
        if (!cookies) {
            const account = await Account.find(Number(accountId));
            if (!account) {
                throw new SessionError(`Account ${accountId} not found in database`, accountId);
            }
            cookies = await SessionManager.loginSync(accountId, account.email, account.password);
        }
        const supplierData = await SessionManager.getSupplierData(accountId);
        if (!supplierData) {
            throw new SessionError(`Supplier data not found in cache for account ${accountId}`, accountId);
        }
        return new MeeshoApiClient(accountId, cookies, supplierData);
    }
    get supplier() {
        return this.supplierData;
    }
    async request(url, options = {}) {
        const maxRetries = options.retries ?? DEFAULT_RETRIES;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(url, {
                    method: options.method || 'POST',
                    headers: this.buildHeaders(options),
                    body: options.body ? JSON.stringify(options.body) : undefined,
                });
                if (res.status === 401) {
                    const refreshed = await this.refreshSession();
                    if (!refreshed) {
                        throw new SessionError(`Re-login failed for account ${this.accountId} after 401`, this.accountId);
                    }
                    const retryRes = await fetch(url, {
                        method: options.method || 'POST',
                        headers: this.buildHeaders(options),
                        body: options.body ? JSON.stringify(options.body) : undefined,
                    });
                    if (!retryRes.ok) {
                        const body = await retryRes.text().catch(() => 'Unknown error');
                        throw new ApiError(`Request failed after re-login (HTTP ${retryRes.status})`, retryRes.status, body, this.accountId);
                    }
                    const data = (await retryRes.json());
                    return { data, status: retryRes.status, headers: retryRes.headers };
                }
                if (res.status >= 500 && attempt < maxRetries) {
                    await this.sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
                    continue;
                }
                if (!res.ok) {
                    const body = await res.text().catch(() => 'Unknown error');
                    throw new ApiError(`Request to ${url} failed (HTTP ${res.status})`, res.status, body, this.accountId);
                }
                const data = (await res.json());
                return { data, status: res.status, headers: res.headers };
            }
            catch (error) {
                if (error instanceof ApiError || error instanceof SessionError) {
                    throw error;
                }
                if (attempt < maxRetries) {
                    await this.sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
                    continue;
                }
                throw new ApiError(`Network error calling ${url}: ${error.message}`, 0, error.message, this.accountId);
            }
        }
        throw new ApiError(`Exhausted retries for ${url}`, 0, 'Max retries reached', this.accountId);
    }
    async post(url, body, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }
    buildHeaders(options) {
        const headers = {
            'Content-Type': 'application/json',
            'client-type': 'd-web',
        };
        if (!options.skipAuth) {
            headers['identifier'] = this.supplierData.identifier;
            headers['cookie'] = formatCookieString(this.sessionCookies);
        }
        return { ...headers, ...(options.headers || {}) };
    }
    async refreshSession() {
        try {
            await SessionManager.invalidate(this.accountId);
            const account = await Account.find(Number(this.accountId));
            if (!account)
                return false;
            const newCookies = await SessionManager.loginSync(this.accountId, account.email, account.password);
            this.sessionCookies = newCookies;
            const newSupplierData = await SessionManager.getSupplierData(this.accountId);
            if (newSupplierData) {
                this.supplierData = newSupplierData;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
export function formatCookieString(cookies) {
    return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}
//# sourceMappingURL=client.js.map