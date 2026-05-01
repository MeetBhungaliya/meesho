import LoginAccount from '#jobs/login_account'
import Account from '#models/account'
import { MeeshoApiClient } from '#services/external_api/client'
import {
  CACHE_PREFIX,
  MEESHO_ENDPOINTS,
  SESSION_COOKIE_KEYS,
  SESSION_STATUS
} from '#services/external_api/constants'
import { ApiError, SessionError } from '#services/external_api/errors'
import type {
  AccountId,
  MeeshoSupplierPrefetchResponse,
  SupplierCacheData,
} from '#services/external_api/types'
import cache from '@adonisjs/cache/services/main'
import { DateTime } from 'luxon'

export interface SessionCookies {
  [key: string]: string
}

export class SessionManager {
  static async getSession(accountId: AccountId): Promise<SessionCookies | null> {
    return cache.get({ key: `${CACHE_PREFIX.session}${accountId}` })
  }

  static async getSupplierData(accountId: AccountId): Promise<SupplierCacheData | null> {
    return cache.get({ key: `${CACHE_PREFIX.supplier}${accountId}` })
  }

  static async login(accountId: AccountId, email: string, password: string): Promise<void> {
    const account = await Account.findOrFail(Number(accountId))
    account.sessionStatus = SESSION_STATUS.PENDING
    account.sessionError = null
    await account.save()

    await LoginAccount.dispatch({ accountId, email, password })
  }

  static async loginSync(
    accountId: AccountId,
    email: string,
    password: string
  ): Promise<SessionCookies> {
    const sessionCacheKey = `${CACHE_PREFIX.session}${accountId}`
    const supplierCacheKey = `${CACHE_PREFIX.supplier}${accountId}`

    const account = await Account.findOrFail(Number(accountId))
    account.sessionStatus = SESSION_STATUS.PENDING
    account.sessionError = null
    await account.save()

    const payload = {
      email,
      password,
      device_id: email,
      instance: email,
    }

    const client = MeeshoApiClient.createForLogin(accountId)

    let loginRes
    try {
      loginRes = await client.post(MEESHO_ENDPOINTS.login, payload, { skipAuth: true })
    } catch (err: any) {
      const errorMsg = err instanceof ApiError 
        ? `Login failed (HTTP ${err.status}): ${err.message}` 
        : `Network error during login: ${err.message}`
        
      account.sessionStatus = SESSION_STATUS.FAILED
      account.sessionError = errorMsg
      await account.save()
      throw new SessionError(errorMsg, accountId)
    }

    const cookies = SessionManager.extractCookies(loginRes.headers)

    if (!cookies[SESSION_COOKIE_KEYS.identifier] || !cookies[SESSION_COOKIE_KEYS.sid]) {
      const errorMsg = 'Login succeeded but required cookies were not returned'

      account.sessionStatus = SESSION_STATUS.FAILED
      account.sessionError = errorMsg
      await account.save()

      throw new SessionError(errorMsg, accountId)
    }

    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const supplierPayload = {
      identifier: cookies[SESSION_COOKIE_KEYS.identifier],
    }

    let supplierDataRes
    try {
      supplierDataRes = await client.post<MeeshoSupplierPrefetchResponse>(
        MEESHO_ENDPOINTS.prefetchSupplyData, 
        supplierPayload, 
        { 
          skipAuth: true,
          headers: {
            'identifier': cookies[SESSION_COOKIE_KEYS.identifier],
            'cookie': cookieString,
          }
        }
      )
    } catch (err: any) {
      const errorMsg = err instanceof ApiError 
        ? `Prefetch failed (HTTP ${err.status}): ${err.message}` 
        : `Network error during prefetch: ${err.message}`
        
      account.sessionStatus = SESSION_STATUS.FAILED
      account.sessionError = errorMsg
      await account.save()
      throw new SessionError(errorMsg, accountId)
    }

    let supplierData: MeeshoSupplierPrefetchResponse = supplierDataRes.data

    await cache.setForever({
      key: supplierCacheKey,
      value: {
        id: supplierData.user.id,
        email: supplierData.user.email,
        phone: supplierData.user.mobile_number,
        supplierId: supplierData.supplier.supplier_id,
        name: supplierData.supplier.name,
        identifier: supplierData.supplier.identifier,
      } satisfies SupplierCacheData,
    })

    await cache.set({
      key: sessionCacheKey,
      value: cookies,
      ttl: '24h',
    })

    account.sessionStatus = SESSION_STATUS.ACTIVE
    account.sessionError = null
    account.lastLoginAt = DateTime.utc()
    await account.save()

    return cookies
  }

  static async invalidate(accountId: AccountId): Promise<void> {
    await cache.delete({ key: `${CACHE_PREFIX.session}${accountId}` })

    const account = await Account.find(Number(accountId))
    if (account) {
      account.sessionStatus = SESSION_STATUS.EXPIRED
      await account.save()
    }
  }

  static extractCookies(headers: Headers): Record<string, string> {
    const raw = headers.getSetCookie() || []
    const allowedKeys: string[] = [SESSION_COOKIE_KEYS.identifier, SESSION_COOKIE_KEYS.sid]
    const cookieMap: Record<string, string> = {}

    for (const cookie of raw) {
      const [pair] = cookie.split(';')
      const [key, value] = pair.split('=')

      if (!allowedKeys.includes(key)) continue
      if (!value) continue

      cookieMap[key] = value
    }

    return cookieMap
  }
}
