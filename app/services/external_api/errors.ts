export class ApiError extends Error {
  readonly status: number
  readonly body: string
  readonly accountId: string

  constructor(message: string, status: number, body: string, accountId: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.accountId = accountId
  }
}

export class SessionError extends Error {
  readonly accountId: string

  constructor(message: string, accountId: string) {
    super(message)
    this.name = 'SessionError'
    this.accountId = accountId
  }
}
