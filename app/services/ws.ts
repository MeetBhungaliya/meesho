import { WebSocketServer, WebSocket } from 'ws'
import type { ServerOptions } from 'ws'
import type { IncomingMessage } from 'node:http'
import crypto from 'node:crypto'
import server from '@adonisjs/core/services/server'
import { Secret } from '@adonisjs/core/helpers'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'

export interface AuthenticatedWebSocket extends WebSocket {
  id: string
  user?: User
  isAuthenticated: boolean
  isAlive: boolean
  channels: Set<string>
  ip?: string
}

export type ChannelAuthorizer = (
  user: User | null,
  params: Record<string, string>,
  socket: AuthenticatedWebSocket
) => boolean | Promise<boolean>

interface ChannelRoute {
  pattern: string
  regex: RegExp
  paramNames: string[]
  authorizer: ChannelAuthorizer
}

class Ws {
  io: WebSocketServer | undefined
  private booted = false
  private instanceId = crypto.randomUUID()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private channelSubscribers: Map<string, Set<AuthenticatedWebSocket>> = new Map()
  private channelRoutes: ChannelRoute[] = []

  /**
   * Alias for io
   */
  get wss(): WebSocketServer | undefined {
    return this.io
  }

  /**
   * Register a channel authorization handler
   * Supports route params like 'accounts/:userId', ':userId/:accountId', 'ad-launch::jobId', etc.
   */
  authorize(pattern: string, authorizer: ChannelAuthorizer) {
    const paramNames: string[] = []
    const escaped = pattern
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name)
        return '([^/:]+)'
      })
      .replace(/\*/g, '.*')

    const regex = new RegExp(`^${escaped}$`)
    this.channelRoutes.push({
      pattern,
      regex,
      paramNames,
      authorizer,
    })
  }

  /**
   * Check if a socket is authorized to join a channel
   */
  async checkAuthorization(channel: string, socket: AuthenticatedWebSocket): Promise<boolean> {
    for (const route of this.channelRoutes) {
      const match = channel.match(route.regex)
      if (match) {
        const params: Record<string, string> = {}
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1]
        })
        try {
          return await route.authorizer(socket.user || null, params, socket)
        } catch (err) {
          logger.error({ err, channel }, 'Error during WebSocket channel authorization')
          return false
        }
      }
    }

    // Default policy: channel requires authentication if not explicitly public
    return socket.isAuthenticated
  }

  /**
   * Extract access token from incoming HTTP upgrade request
   */
  extractToken(request: IncomingMessage): string | null {
    // 1. Authorization header: "Bearer <token>"
    const authHeader = request.headers['authorization']
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim()
    }

    // 2. Query parameter: ?token=<token>
    if (request.url) {
      try {
        const url = new URL(request.url, 'http://localhost')
        const tokenParam = url.searchParams.get('token')
        if (tokenParam) {
          return tokenParam.trim()
        }
      } catch {}
    }

    // 3. Sec-WebSocket-Protocol (if client passed token as subprotocol)
    const protocol = request.headers['sec-websocket-protocol']
    if (protocol) {
      const parts = protocol.split(',').map((p) => p.trim())
      for (const part of parts) {
        if (part.startsWith('token.')) {
          return part.slice(6)
        }
      }
    }

    return null
  }

  /**
   * Verify token and fetch the associated User
   */
  async verifyToken(tokenString: string): Promise<User | null> {
    try {
      const accessToken = await User.accessTokens.verify(new Secret(tokenString))
      if (!accessToken) {
        return null
      }
      const user = await User.find(accessToken.tokenableId)
      return user || null
    } catch (error) {
      logger.warn({ error }, 'Failed to verify WebSocket access token')
      return null
    }
  }

  /**
   * Initialize the WebSocket server
   */
  boot(options?: Partial<ServerOptions>) {
    if (this.booted) {
      return
    }

    this.booted = true

    const nodeServer = server.getNodeServer()
    if (!nodeServer) {
      return
    }

    this.io = new WebSocketServer({
      server: nodeServer,
      maxPayload: 128 * 1024, // 128 KB max payload security limit
      ...options,
    })

    // Setup heartbeat to terminate dead connections
    this.heartbeatInterval = setInterval(() => {
      if (!this.io) return
      for (const client of this.io.clients as Set<AuthenticatedWebSocket>) {
        if (client.isAlive === false) {
          this.unsubscribeAll(client)
          client.terminate()
          continue
        }
        client.isAlive = false
        client.ping()
      }
    }, 30000)

    nodeServer.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
      }
    })

    // Setup connection lifecycle and auth
    this.io.on('connection', async (rawSocket: WebSocket, request: IncomingMessage) => {
      const socket = rawSocket as AuthenticatedWebSocket
      socket.id = crypto.randomUUID()
      socket.isAlive = true
      socket.isAuthenticated = false
      socket.channels = new Set()
      socket.ip = request.socket.remoteAddress

      socket.on('pong', () => {
        socket.isAlive = true
      })

      // Authenticate via upgrade request if token present
      const initialToken = this.extractToken(request)
      if (initialToken) {
        const user = await this.verifyToken(initialToken)
        if (user) {
          socket.user = user
          socket.isAuthenticated = true
          socket.send(
            JSON.stringify({
              event: 'authenticated',
              user: { id: user.id, email: user.email },
            })
          )
        }
      }

      // Handle incoming messages
      socket.on('message', async (raw) => {
        let messageStr: string
        if (typeof raw === 'string') {
          messageStr = raw
        } else if (Buffer.isBuffer(raw)) {
          messageStr = raw.toString('utf-8')
        } else if (Array.isArray(raw)) {
          messageStr = Buffer.concat(raw).toString('utf-8')
        } else {
          messageStr = Buffer.from(raw).toString('utf-8')
        }

        // Plain text ping/pong support
        if (messageStr.trim().toUpperCase() === 'PING') {
          socket.send('PONG')
          return
        }

        let payload: any
        try {
          payload = JSON.parse(messageStr)
        } catch {
          socket.send(JSON.stringify({ event: 'error', message: 'Invalid JSON payload' }))
          return
        }

        const action = payload.action || payload.type || payload.event
        const channel = payload.channel || payload.topic

        switch (action) {
          case 'ping': {
            socket.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }))
            break
          }

          case 'auth':
          case 'authenticate': {
            const token = payload.token
            if (!token) {
              socket.send(JSON.stringify({ event: 'auth_error', message: 'Token is required' }))
              return
            }
            const user = await this.verifyToken(token)
            if (!user) {
              socket.send(
                JSON.stringify({ event: 'auth_error', message: 'Invalid or expired token' })
              )
              return
            }
            socket.user = user
            socket.isAuthenticated = true
            socket.send(
              JSON.stringify({
                event: 'authenticated',
                user: { id: user.id, email: user.email },
              })
            )
            break
          }

          case 'subscribe': {
            if (!channel) {
              socket.send(
                JSON.stringify({ event: 'error', message: 'Channel is required for subscribe' })
              )
              return
            }

            if (socket.channels.size >= 100) {
              socket.send(
                JSON.stringify({
                  event: 'subscription_error',
                  channel,
                  message: 'Channel limit exceeded',
                })
              )
              return
            }

            const isAuthorized = await this.checkAuthorization(channel, socket)
            if (!isAuthorized) {
              socket.send(
                JSON.stringify({
                  event: 'subscription_error',
                  channel,
                  message: socket.isAuthenticated ? 'Forbidden' : 'Unauthorized',
                })
              )
              return
            }

            this.subscribe(socket, channel)
            socket.send(JSON.stringify({ event: 'subscribed', channel }))
            break
          }

          case 'unsubscribe': {
            if (!channel) {
              socket.send(
                JSON.stringify({ event: 'error', message: 'Channel is required for unsubscribe' })
              )
              return
            }
            this.unsubscribe(socket, channel)
            socket.send(JSON.stringify({ event: 'unsubscribed', channel }))
            break
          }

          default: {
            socket.send(JSON.stringify({ event: 'error', message: `Unknown action: ${action}` }))
            break
          }
        }
      })

      socket.on('close', () => {
        this.unsubscribeAll(socket)
      })

      socket.on('error', (err) => {
        logger.error({ err, socketId: socket.id }, 'WebSocket client error')
        this.unsubscribeAll(socket)
      })
    })

    // Initialize Redis subscription for multi-process / worker broadcasting
    this.initRedis()
  }

  /**
   * Subscribe socket to a channel
   */
  subscribe(socket: AuthenticatedWebSocket, channel: string) {
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set())
    }
    this.channelSubscribers.get(channel)!.add(socket)
    socket.channels.add(channel)
  }

  /**
   * Unsubscribe socket from a channel
   */
  unsubscribe(socket: AuthenticatedWebSocket, channel: string) {
    const subscribers = this.channelSubscribers.get(channel)
    if (subscribers) {
      subscribers.delete(socket)
      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channel)
      }
    }
    socket.channels.delete(channel)
  }

  /**
   * Unsubscribe socket from all channels
   */
  unsubscribeAll(socket: AuthenticatedWebSocket) {
    for (const channel of socket.channels) {
      const subscribers = this.channelSubscribers.get(channel)
      if (subscribers) {
        subscribers.delete(socket)
        if (subscribers.size === 0) {
          this.channelSubscribers.delete(channel)
        }
      }
    }
    socket.channels.clear()
  }

  /**
   * Broadcast message locally to all sockets subscribed to a channel
   */
  broadcastLocal(channel: string, data: unknown) {
    const subscribers = this.channelSubscribers.get(channel)
    if (!subscribers || subscribers.size === 0) {
      return
    }

    const payload = JSON.stringify({
      channel,
      data,
      ...(typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}),
    })

    for (const client of subscribers) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  /**
   * Broadcast message to all connected clients regardless of channel
   */
  broadcastAll(data: unknown) {
    if (!this.io) {
      return
    }

    const payload = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)

    for (const client of this.io.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  /**
   * Broadcast to channel (or globally if no channel provided).
   * Also publishes to Redis to support cross-process queue worker events.
   */
  async broadcast(channelOrData: string | unknown, data?: unknown) {
    if (typeof channelOrData === 'string' && data !== undefined) {
      this.broadcastLocal(channelOrData, data)

      // Publish to Redis for queue workers and multi-instance sync
      try {
        const redisModule = await import('@adonisjs/redis/services/main')
        const redis = redisModule.default
        await redis.publish(
          'ws:broadcast',
          JSON.stringify({
            channel: channelOrData,
            data,
            instanceId: this.instanceId,
          })
        )
      } catch {
        // Safe to ignore if Redis is not running or unavailable
      }
      return
    }

    this.broadcastAll(channelOrData)
  }

  /**
   * Listen to Redis broadcast messages from queue workers or other instances
   */
  private async initRedis() {
    try {
      const redisModule = await import('@adonisjs/redis/services/main')
      const redis = redisModule.default
      const subscriber = redis.connection('main')
      await subscriber.subscribe('ws:broadcast', (rawMessage: string) => {
        try {
          const { channel, data, instanceId } = JSON.parse(rawMessage)
          if (instanceId !== this.instanceId) {
            this.broadcastLocal(channel, data)
          }
        } catch {}
      })
    } catch {
      logger.debug('Redis pub/sub not initialized for WebSocket (running in single-node mode)')
    }
  }
}

export { WebSocket, WebSocketServer }
export default new Ws()
