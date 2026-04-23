export class ApiError extends Error {
    status;
    body;
    accountId;
    constructor(message, status, body, accountId) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
        this.accountId = accountId;
    }
}
export class SessionError extends Error {
    accountId;
    constructor(message, accountId) {
        super(message);
        this.name = 'SessionError';
        this.accountId = accountId;
    }
}
//# sourceMappingURL=errors.js.map