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
        const DEBUG = true;
        const log = (...args) => DEBUG && console.log('[MEESHO DEBUG]', ...args);
        await Account.query().where('id', Number(accountId)).update({
            session_status: SESSION_STATUS.PENDING,
            session_error: null,
        });
        const payload = {
            email,
            password,
            device_id: email,
            instance: email,
        };
        log('LOGIN REQUEST BODY:', payload);
        const res = await fetch(MEESHO_ENDPOINTS.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
            },
            body: JSON.stringify(payload),
        });
        const rawHeaders = Object.fromEntries(res.headers.entries());
        const rawSetCookie = res.headers.get('set-cookie');
        const rawBody = await res.text();
        log('LOGIN STATUS:', res.status);
        log('LOGIN HEADERS:', rawHeaders);
        log('LOGIN SET-COOKIE:', rawSetCookie);
        log('LOGIN BODY:', rawBody);
        if (res.status !== 200) {
            const errorMsg = `Login failed (HTTP ${res.status}): ${rawBody.substring(0, 500)}`;
            await Account.query().where('id', Number(accountId)).update({
                session_status: SESSION_STATUS.FAILED,
                session_error: errorMsg,
            });
            throw new SessionError(errorMsg, accountId);
        }
        const cookies = SessionManager.extractCookies(res.headers);
        log('EXTRACTED COOKIES:', cookies);
        if (!cookies[SESSION_COOKIE_KEYS.identifier] || !cookies[SESSION_COOKIE_KEYS.sid]) {
            const errorMsg = 'Login succeeded but required cookies were not returned';
            log('COOKIE VALIDATION FAILED');
            await Account.query().where('id', Number(accountId)).update({
                session_status: SESSION_STATUS.FAILED,
                session_error: errorMsg,
            });
            throw new SessionError(errorMsg, accountId);
        }
        const cookieString = Object.entries(cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
        log('COOKIE STRING:', cookieString);
        const supplierPayload = {
            identifier: cookies[SESSION_COOKIE_KEYS.identifier],
        };
        log('PREFETCH REQUEST BODY:', supplierPayload);
        const supplierDataRes = await fetch(MEESHO_ENDPOINTS.prefetchSupplyData, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                identifier: cookies[SESSION_COOKIE_KEYS.identifier],
                cookie: cookieString,
                Accept: '*/*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
            },
            body: JSON.stringify(supplierPayload),
        });
        const supplierRawHeaders = Object.fromEntries(supplierDataRes.headers.entries());
        const supplierRawBody = await supplierDataRes.text();
        log('PREFETCH STATUS:', supplierDataRes.status);
        log('PREFETCH HEADERS:', supplierRawHeaders);
        log('PREFETCH BODY:', supplierRawBody);
        if (supplierDataRes.status !== 200) {
            const errorMsg = `Prefetch failed (HTTP ${supplierDataRes.status}): ${supplierRawBody.substring(0, 500)}`;
            await Account.query().where('id', Number(accountId)).update({
                session_status: SESSION_STATUS.FAILED,
                session_error: errorMsg,
            });
            throw new SessionError(errorMsg, accountId);
        }
        let supplierData;
        try {
            supplierData = JSON.parse(supplierRawBody);
        }
        catch (err) {
            log('JSON PARSE ERROR:', err);
            throw new SessionError('Invalid JSON response from supplier API', accountId);
        }
        log('PARSED SUPPLIER DATA:', supplierData);
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
        log('LOGIN FLOW SUCCESS ✅');
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