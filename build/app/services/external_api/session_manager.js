import LoginAccount from '#jobs/login_account';
import Account from '#models/account';
import { CACHE_PREFIX, MEESHO_ENDPOINTS, SESSION_COOKIE_KEYS, SESSION_STATUS, } from '#services/external_api/constants';
import { SessionError } from '#services/external_api/errors';
import cache from '@adonisjs/cache/services/main';
import { DateTime } from 'luxon';
export class SessionManager {
    static async getSession(accountId) {
        return cache.get({ key: `${CACHE_PREFIX.session}${accountId}` });
    }
    static async getSupplierData(accountId) {
        return cache.get({ key: `${CACHE_PREFIX.supplier}${accountId}` });
    }
    static async login(accountId, email, password) {
        await Account.query().where('id', Number(accountId)).update({
            session_status: SESSION_STATUS.PENDING,
            session_error: null,
        });
        await LoginAccount.dispatch({ accountId, email, password });
    }
    static async loginSync(accountId, email, password) {
        const sessionCacheKey = `${CACHE_PREFIX.session}${accountId}`;
        const supplierCacheKey = `${CACHE_PREFIX.supplier}${accountId}`;
        await Account.query().where('id', Number(accountId)).update({
            session_status: SESSION_STATUS.PENDING,
            session_error: null,
        });
        const res = await fetch(MEESHO_ENDPOINTS.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: '*/*' },
            body: JSON.stringify({
                password,
                device_id: email,
                instance: email,
                email,
            }),
        });
        if (res.status !== 200) {
            const body = await res.text().catch(() => 'Unknown error');
            const errorMsg = `Login failed (HTTP ${res.status}): ${body.substring(0, 500)}`;
            await Account.query().where('id', Number(accountId)).update({
                session_status: SESSION_STATUS.FAILED,
                session_error: errorMsg,
            });
            throw new SessionError(errorMsg, accountId);
        }
        const cookies = SessionManager.extractCookies(res.headers);
        if (!cookies[SESSION_COOKIE_KEYS.identifier] || !cookies[SESSION_COOKIE_KEYS.sid]) {
            const errorMsg = 'Login succeeded but required cookies were not returned';
            await Account.query().where('id', Number(accountId)).update({
                session_status: SESSION_STATUS.FAILED,
                session_error: errorMsg,
            });
            throw new SessionError(errorMsg, accountId);
        }
        const cookieString = Object.entries(cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
        const supplierDataRes = await fetch(MEESHO_ENDPOINTS.prefetchSupplyData, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'identifier': cookies[SESSION_COOKIE_KEYS.identifier],
                'cookie': cookieString,
                'Accept': '*/*',
            },
            body: JSON.stringify({ identifier: cookies[SESSION_COOKIE_KEYS.identifier] }),
        });
        const supplierData = (await supplierDataRes.json());
        await cache.setForever({
            key: supplierCacheKey,
            value: {
                id: supplierData.user.id,
                email: supplierData.user.email,
                phone: supplierData.user.mobile_number,
                supplierId: supplierData.supplier.supplier_id,
                name: supplierData.supplier.name,
                identifier: supplierData.supplier.identifier,
            },
        });
        await cache.set({
            key: sessionCacheKey,
            value: cookies,
            ttl: '24h',
        });
        await Account.query().where('id', Number(accountId)).update({
            session_status: SESSION_STATUS.ACTIVE,
            session_error: null,
            last_login_at: DateTime.utc().toISO(),
        });
        return cookies;
    }
    static async invalidate(accountId) {
        await cache.delete({ key: `${CACHE_PREFIX.session}${accountId}` });
        await Account.query().where('id', Number(accountId)).update({
            session_status: SESSION_STATUS.EXPIRED,
        });
    }
    static extractCookies(headers) {
        const raw = headers.getSetCookie() || [];
        const allowedKeys = [SESSION_COOKIE_KEYS.identifier, SESSION_COOKIE_KEYS.sid];
        const cookieMap = {};
        for (const cookie of raw) {
            const [pair] = cookie.split(';');
            const [key, value] = pair.split('=');
            if (!allowedKeys.includes(key))
                continue;
            if (!value)
                continue;
            cookieMap[key] = value;
        }
        return cookieMap;
    }
}
//# sourceMappingURL=session_manager.js.map