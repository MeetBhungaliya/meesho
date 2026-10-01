import User from '#models/user'
import RefreshToken from '#models/refresh_token'
import { createUserValidator, loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'

export default class UsersController {
  private formatUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.email.split('@')[0], // Extract name from email prefix
      role: 'admin', // Grant Admin role for full permissions on frontend
      permissions: [],
      createdAt: user.createdAt?.toISO(),
      updatedAt: user.updatedAt?.toISO(),
    }
  }

  async signup({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)
    const user = await User.create(payload)
    return response.created({
      message: 'User created successfully',
      data: { user: this.formatUser(user) },
    })
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)

    // Create access token valid for 15 minutes
    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '15m',
    })

    // Create refresh token valid for 7 days
    const refreshTokenString = crypto.randomBytes(40).toString('hex')
    await RefreshToken.create({
      userId: user.id,
      token: refreshTokenString,
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const accessTokenValue = token.value!.release()

    // Set Cookies (still useful for same-origin web clients)
    response.cookie('access_token', accessTokenValue, {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
      maxAge: 15 * 60, // 15 mins
    })

    response.cookie('refresh_token', refreshTokenString, {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    // Return tokens in body for Safari/Capacitor (cross-origin cookie issues)
    return response.ok({
      message: 'Login successful.',
      data: {
        user: this.formatUser(user),
        accessToken: accessTokenValue,
        refreshToken: refreshTokenString,
      },
    })
  }

  async refresh({ request, response }: HttpContext) {
    // Accept refresh token from cookie (web) or request body (Safari/Capacitor)
    const refreshTokenString = request.cookie('refresh_token') || request.input('refreshToken')

    if (!refreshTokenString) {
      return response.unauthorized({ message: 'Refresh token missing' })
    }

    const dbToken = await RefreshToken.query()
      .where('token', refreshTokenString)
      .andWhere('expires_at', '>', DateTime.now().toSQL())
      .first()

    if (!dbToken) {
      return response.unauthorized({ message: 'Invalid or expired refresh token' })
    }

    const user = await User.find(dbToken.userId)
    if (!user) {
      return response.unauthorized({ message: 'User not found' })
    }

    // Rotate refresh token (delete old, create new)
    await dbToken.delete()

    const newAccessToken = await User.accessTokens.create(user, ['*'], {
      expiresIn: '15m',
    })

    const newRefreshTokenString = crypto.randomBytes(40).toString('hex')
    await RefreshToken.create({
      userId: user.id,
      token: newRefreshTokenString,
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const accessTokenValue = newAccessToken.value!.release()

    // Set new cookies (still useful for same-origin web clients)
    response.cookie('access_token', accessTokenValue, {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
      maxAge: 15 * 60,
    })

    response.cookie('refresh_token', newRefreshTokenString, {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60,
    })

    // Return tokens in body for Safari/Capacitor (cross-origin cookie issues)
    return response.ok({
      message: 'Token refreshed successfully.',
      data: {
        user: this.formatUser(user),
        accessToken: accessTokenValue,
        refreshToken: newRefreshTokenString,
      },
    })
  }

  async logout({ request, response }: HttpContext) {
    const refreshTokenString = request.cookie('refresh_token')

    if (refreshTokenString) {
      const dbToken = await RefreshToken.query().where('token', refreshTokenString).first()
      if (dbToken) {
        await dbToken.delete()
      }
    }

    // Clear cookies (Must match exact sameSite and secure settings)
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
    })
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: app.inProduction,
      sameSite: app.inProduction ? 'none' : 'lax',
    })

    return response.ok({ message: 'Logged out successfully.' })
  }

  async me({ auth, response }: HttpContext) {
    if (!auth.user) {
      return response.unauthorized({ message: 'Unauthorized' })
    }
    return response.ok({
      data: { user: this.formatUser(auth.user) },
    })
  }
}
