import { hash, verify } from 'argon2';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import { createError } from '../../middleware/error-handler';
import type { SignupInput, LoginInput } from './auth.schema';
import type { FastifyInstance } from 'fastify';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserPayload {
  id: string;
  username: string;
  email: string;
}

export class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  async signup(input: SignupInput, userAgent?: string, ipAddress?: string): Promise<AuthTokens & { user: UserPayload }> {
    const dbUp = await isDbAvailable();

    if (!dbUp) {
      const existing = devStore.findUserByEmailOrUsername(input.email) || devStore.findUserByEmailOrUsername(input.username);
      if (existing) {
        throw createError(409, existing.email.toLowerCase() === input.email.toLowerCase() ? 'Email is already registered' : 'Username is already taken');
      }

      const passwordHash = await hash(input.password);
      const user = devStore.createUser({
        username: input.username,
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? input.username,
        avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop`,
      });

      const userPayload = { id: user.id, username: user.username, email: user.email };
      const tokens = await this.generateTokenPair(userPayload, userAgent, ipAddress);
      return { ...tokens, user: userPayload };
    }

    // Check uniqueness in DB
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
    ]);

    if (existingEmail) throw createError(409, 'Email is already registered');
    if (existingUsername) throw createError(409, 'Username is already taken');

    // Hash password with Argon2id (resistant to GPU attacks)
    const passwordHash = await hash(input.password, {
      type: 2, // argon2id
      memoryCost: 65536, // 64MB
      timeCost: 3,
      parallelism: 4,
    });

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? input.username,
      },
      select: { id: true, username: true, email: true },
    });

    const tokens = await this.generateTokenPair(user, userAgent, ipAddress);
    return { ...tokens, user };
  }

  async login(input: LoginInput, userAgent?: string, ipAddress?: string): Promise<AuthTokens & { user: UserPayload }> {
    const dbUp = await isDbAvailable();

    if (!dbUp) {
      const devUser = devStore.findUserByEmailOrUsername(input.identifier);
      if (!devUser) throw createError(401, 'Invalid credentials');

      const isValid = await verify(devUser.passwordHash, input.password);
      if (!isValid) throw createError(401, 'Invalid credentials');

      const userPayload = { id: devUser.id, username: devUser.username, email: devUser.email };
      const tokens = await this.generateTokenPair(userPayload, userAgent, ipAddress);
      return { ...tokens, user: userPayload };
    }

    // Allow login with email or username
    const isEmail = input.identifier.includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: input.identifier.toLowerCase() }
        : { username: input.identifier.toLowerCase() },
      select: { id: true, username: true, email: true, passwordHash: true },
    });

    if (!user) throw createError(401, 'Invalid credentials');

    const isValid = await verify(user.passwordHash, input.password);
    if (!isValid) throw createError(401, 'Invalid credentials');

    const { passwordHash: _, ...userPayload } = user;
    const tokens = await this.generateTokenPair(userPayload, userAgent, ipAddress);
    return { ...tokens, user: userPayload };
  }

  async refresh(token: string): Promise<AuthTokens> {
    const dbUp = await isDbAvailable();

    if (!dbUp) {
      const stored = devStore.getRefreshToken(token);
      if (!stored || stored.expiresAt < new Date()) {
        throw createError(401, 'Refresh token has expired, please log in again');
      }
      const user = devStore.findUserById(stored.userId);
      if (!user) throw createError(401, 'User not found');
      devStore.deleteRefreshToken(token);
      return this.generateTokenPair({ id: user.id, username: user.username, email: user.email });
    }

    // Verify the refresh token exists in DB and hasn't expired
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    if (!stored) throw createError(401, 'Invalid refresh token');
    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token } });
      throw createError(401, 'Refresh token has expired, please log in again');
    }

    // Rotate: delete old token, issue new pair
    await prisma.refreshToken.delete({ where: { token } });
    return this.generateTokenPair(stored.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      devStore.deleteRefreshToken(refreshToken);
      return;
    }
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  async logoutAll(userId: string): Promise<void> {
    const dbUp = await isDbAvailable();
    if (dbUp) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  }

  private async generateTokenPair(
    user: UserPayload,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const payload = { id: user.id, username: user.username, email: user.email };

    // Access token — short-lived, stateless
    const accessToken = this.fastify.jwt.sign(payload, {
      expiresIn: env.JWT_ACCESS_EXPIRY,
    });

    // Refresh token — long-lived, stored in DB for rotation
    const refreshToken = randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    try {
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
          userAgent: userAgent?.slice(0, 500),
          ipAddress: ipAddress?.slice(0, 45),
        },
      });
    } catch {
      devStore.saveRefreshToken(refreshToken, user.id, expiresAt);
    }

    // Parse access expiry to seconds
    const expiresIn = this.parseExpiry(env.JWT_ACCESS_EXPIRY);

    return { accessToken, refreshToken, expiresIn };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
