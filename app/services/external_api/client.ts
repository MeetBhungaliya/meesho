import { ApiError, SessionError } from '#services/external_api/errors'
import { SessionManager } from '#services/external_api/session_manager'
import type { SessionCookies } from '#services/external_api/session_manager'
import type { ApiResponse, RequestOptions, SupplierCacheData } from '#services/external_api/types'
import {
  API_HEADERS,
  MEESHO_SESSION_EXPIRED_STATUS,
  SESSION_STATUS,
} from '#services/external_api/constants'
import Account from '#models/account'

const DEFAULT_RETRIES = 2
const BACKOFF_BASE_MS = 500

export class MeeshoApiClient {
  private accountId: string
  private sessionCookies?: SessionCookies
  private supplierData?: SupplierCacheData

  private constructor(
    accountId: string,
    sessionCookies?: SessionCookies,
    supplierData?: SupplierCacheData
  ) {
    this.accountId = accountId
    this.sessionCookies = sessionCookies
    this.supplierData = supplierData
  }

  static createForLogin(accountId: string): MeeshoApiClient {
    return new MeeshoApiClient(accountId)
  }

  static async forAccount(accountId: string): Promise<MeeshoApiClient> {
    let cookies = await SessionManager.getSession(accountId)

    if (!cookies) {
      const account = await Account.find(Number(accountId))
      if (!account) {
        throw new SessionError(`Account ${accountId} not found in database`, accountId)
      }

      cookies = await SessionManager.loginSync(accountId, account.email, account.password)
    }

    const supplierData = await SessionManager.getSupplierData(accountId)

    if (!supplierData) {
      throw new SessionError(`Supplier data not found in cache for account ${accountId}`, accountId)
    }

    return new MeeshoApiClient(accountId, cookies, supplierData)
  }

  get supplier(): SupplierCacheData {
    if (!this.supplierData) {
      throw new Error('Supplier data is not available in login context')
    }
    return this.supplierData
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const maxRetries = options.retries ?? DEFAULT_RETRIES

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: options.method || 'POST',
          headers: this.buildHeaders(options),
          body:
            options.body instanceof FormData
              ? options.body
              : options.body
                ? JSON.stringify(options.body)
                : undefined,
        })

        if (res.status === 401 || res.status === MEESHO_SESSION_EXPIRED_STATUS) {
          // 401 = standard unauthorised; 463 = Meesho's custom session-expired code.
          // In both cases: mark account as expired in DB, clear cache, then re-login.
          if (res.status === MEESHO_SESSION_EXPIRED_STATUS) {
            await this.markSessionExpiredInDb()
          }

          const refreshed = await this.refreshSession()
          if (!refreshed) {
            throw new SessionError(
              `Re-login failed for account ${this.accountId} after ${res.status}`,
              this.accountId
            )
          }

          const retryRes = await fetch(url, {
            method: options.method || 'POST',
            headers: this.buildHeaders(options),
            body:
              options.body instanceof FormData
                ? options.body
                : options.body
                  ? JSON.stringify(options.body)
                  : undefined,
          })

          if (!retryRes.ok) {
            const body = await retryRes.text().catch(() => 'Unknown error')
            throw new ApiError(
              `Request failed after re-login (HTTP ${retryRes.status})`,
              retryRes.status,
              body,
              this.accountId
            )
          }

          const rawText = await retryRes.text()
          let data = {} as T
          if (rawText) {
            try {
              data = JSON.parse(rawText)
            } catch {
              data = rawText as unknown as T
            }
          }
          return { data, status: retryRes.status, headers: retryRes.headers }
        }

        if (res.status >= 500 && attempt < maxRetries) {
          await this.sleep(BACKOFF_BASE_MS * Math.pow(2, attempt))
          continue
        }

        if (!res.ok) {
          const body = await res.text().catch(() => 'Unknown error')
          throw new ApiError(
            `Request to ${url} failed (HTTP ${res.status})`,
            res.status,
            body,
            this.accountId
          )
        }

        const rawText = await res.text()
        let data = {} as T
        if (rawText) {
          try {
            data = JSON.parse(rawText)
          } catch {
            data = rawText as unknown as T
          }
        }
        return { data, status: res.status, headers: res.headers }
      } catch (error) {
        if (error instanceof ApiError || error instanceof SessionError) {
          throw error
        }

        if (attempt < maxRetries) {
          await this.sleep(BACKOFF_BASE_MS * Math.pow(2, attempt))
          continue
        }

        throw new ApiError(
          `Network error calling ${url}: ${(error as Error).message}`,
          0,
          (error as Error).message,
          this.accountId
        )
      }
    }

    throw new ApiError(`Exhausted retries for ${url}`, 0, 'Max retries reached', this.accountId)
  }

  async post<T = unknown>(
    url: string,
    body: Record<string, unknown> | FormData,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body })
  }

  async get<T = unknown>(
    url: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  private buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = { ...API_HEADERS }

    if (!options.skipAuth && this.supplierData && this.sessionCookies) {
      headers['identifier'] = this.supplierData.identifier
      headers['cookie'] = formatCookieString(this.sessionCookies)
    }

    const finalHeaders = { ...headers, ...(options.headers || {}) }

    if (options.body instanceof FormData) {
      delete finalHeaders['Content-Type']
    }

    return finalHeaders
  }

  /**
   * Marks the account's session as EXPIRED in the database without touching the cache.
   * Called specifically for Meesho's 463 response before the re-login attempt.
   */
  private async markSessionExpiredInDb(): Promise<void> {
    try {
      const account = await Account.find(Number(this.accountId))
      if (account) {
        account.sessionStatus = SESSION_STATUS.EXPIRED
        account.sessionError = 'Session expired (Meesho returned 463)'
        await account.save()
      }
    } catch {
      // Non-fatal: log nothing, let refreshSession handle the rest
    }
  }

  private async refreshSession(): Promise<boolean> {
    try {
      await SessionManager.invalidate(this.accountId)

      const account = await Account.find(Number(this.accountId))
      if (!account) return false

      const newCookies = await SessionManager.loginSync(
        this.accountId,
        account.email,
        account.password
      )

      this.sessionCookies = newCookies

      const newSupplierData = await SessionManager.getSupplierData(this.accountId)
      if (newSupplierData) {
        this.supplierData = newSupplierData
      }

      return true
    } catch {
      return false
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export function formatCookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
