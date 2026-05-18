import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const ACCESS_TOKEN_TTL_S = 15 * 60;       // 15 minutes
const REFRESH_TOKEN_TTL_S = 30 * 24 * 3600; // 30 days

// JWT identity — pinned so tokens can't be replayed across services that
// happen to share JWT_SECRET. Existing in-flight access tokens (issued
// before this change) will fail verification once → frontend will hit
// /api/auth/refresh which is DB-backed and continues to work.
const JWT_ISSUER = 'schemalab.ru';
const JWT_AUDIENCE = 'schemalab.ru';

// Telegram user IDs are at most ~10 digits. Web-only users get IDs
// starting from 10^15 to avoid any collision.
const WEB_USER_ID_MIN = 1_000_000_000_000_000n;
const WEB_USER_ID_MAX = 9_000_000_000_000_000n;

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw token — hash is stored in DB
  expiresIn: number;    // seconds
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  buildGoogleAuthUrl(state: string): string {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeGoogleCode(code: string): Promise<{ googleId: string; email: string; name: string }> {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) throw new UnauthorizedException('Google token exchange failed');
    const { id_token } = await tokenRes.json() as { id_token: string };

    // Verify the ID token with Google's public key endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
    if (!verifyRes.ok) throw new UnauthorizedException('Google ID token verification failed');
    const payload = await verifyRes.json() as { sub: string; email: string; name: string; aud: string; email_verified: string };

    if (payload.aud !== clientId) throw new UnauthorizedException('Google token audience mismatch');
    if (payload.email_verified !== 'true') throw new UnauthorizedException('Google email not verified');

    return { googleId: payload.sub, email: payload.email, name: payload.name };
  }

  // ─── Telegram Login Widget ─────────────────────────────────────────────────

  verifyTelegramWidgetData(data: Record<string, string>): { id: number; firstName: string } {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();
    const { hash, ...fields } = data;
    if (!hash) throw new UnauthorizedException('Missing hash');

    // Check auth_date (must be within 5 minutes)
    const authDate = parseInt(fields['auth_date'] ?? '0', 10);
    if (Date.now() / 1000 - authDate > 300) throw new UnauthorizedException('Telegram auth data expired');

    // Verify HMAC-SHA256.
    // NB: Login Widget secret key = SHA256(bot_token).
    // (WebApp initData uses HMAC_SHA256("WebAppData", bot_token) — different!)
    const checkString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'))) {
      throw new UnauthorizedException('Invalid Telegram signature');
    }

    const id = parseInt(fields['id'] ?? '', 10);
    if (!id) throw new UnauthorizedException('Missing Telegram user id');
    return { id, firstName: fields['first_name'] ?? '' };
  }

  // ─── Telegram WebApp initData ──────────────────────────────────────────────

  verifyTelegramWebAppData(initData: string): { id: number; firstName: string } {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash in initData');

    // Check auth_date freshness (allow 1 hour for mini apps — WebApp is long-lived)
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    if (Date.now() / 1000 - authDate > 3600) throw new UnauthorizedException('Telegram initData expired');

    // Build check string: all fields except hash, sorted, joined with \n
    params.delete('hash');
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'))) {
      throw new UnauthorizedException('Invalid Telegram WebApp signature');
    }

    // Parse user field (JSON string in initData)
    const userJson = params.get('user');
    if (!userJson) throw new UnauthorizedException('Missing user in initData');
    let user: { id: number; first_name?: string };
    try {
      user = JSON.parse(userJson);
    } catch {
      throw new UnauthorizedException('Invalid user JSON in initData');
    }

    if (!user.id) throw new UnauthorizedException('Missing user id in initData');
    return { id: user.id, firstName: user.first_name ?? '' };
  }

  // ─── Find or create user ───────────────────────────────────────────────────

  async findOrCreateUserByProvider(
    provider: 'telegram' | 'google',
    providerId: string,
    displayName?: string,
    email?: string,
  ): Promise<BigInt> {
    const existing = await (this.prisma as any).authProvider.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    if (existing) {
      // Update display name if changed
      if (displayName) {
        await (this.prisma as any).authProvider.update({
          where: { id: existing.id },
          data: { displayName, email },
        });
      }
      return existing.userId as BigInt;
    }

    // For Telegram: userId = telegramId (maintains backward compat with bot data)
    // For Google: generate a web-only userId in the safe range
    const userId = provider === 'telegram'
      ? BigInt(providerId)
      : this.generateWebUserId();

    // Upsert User (may already exist for telegram users who used the bot)
    await (this.prisma as any).user.upsert({
      where: { id: userId },
      update: displayName ? { firstName: displayName } : {},
      create: { id: userId, firstName: displayName },
    });

    await (this.prisma as any).authProvider.create({
      data: { userId, provider, providerId, displayName, email },
    });

    this.logger.log(`New ${provider} auth provider linked to userId ${userId}`);
    return userId;
  }

  // ─── Account linking (merge two providers to one user) ────────────────────

  async linkProviderToUser(
    userId: BigInt,
    provider: string,
    providerId: string,
    displayName?: string,
    email?: string,
  ): Promise<{ ok: true } | { ok: false; conflictUserId: string }> {
    const existing = await (this.prisma as any).authProvider.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });

    if (existing) {
      if (String(existing.userId) === String(userId)) return { ok: true };
      // The other account is real and has its own userId. Caller decides
      // whether to merge.
      return { ok: false, conflictUserId: String(existing.userId) };
    }

    await (this.prisma as any).authProvider.create({
      data: { userId, provider, providerId, displayName, email },
    });
    this.logger.log(`Linked ${provider} provider to userId ${userId}`);
    return { ok: true };
  }

  // Short-lived signed token used to confirm a merge in the next request
  // (e.g. user must click "Yes, merge" in the UI before destructive work runs).
  buildMergeToken(targetUserId: BigInt, sourceUserId: BigInt, provider: string, providerId: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign(
      { kind: 'merge', target: String(targetUserId), source: String(sourceUserId), provider, providerId },
      secret,
      { expiresIn: 10 * 60, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
  }

  verifyMergeToken(token: string): { target: bigint; source: bigint; provider: string; providerId: string } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const p = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as any;
      if (p.kind !== 'merge') throw new Error('Wrong token kind');
      return { target: BigInt(p.target), source: BigInt(p.source), provider: p.provider, providerId: p.providerId };
    } catch {
      throw new UnauthorizedException('Invalid or expired merge token');
    }
  }

  async unlinkProvider(userId: BigInt, provider: 'google' | 'telegram'): Promise<void> {
    // Don't allow unlinking the last provider — user would lose access
    const all = await (this.prisma as any).authProvider.findMany({ where: { userId } });
    if (all.length <= 1) {
      throw new ConflictException('Cannot unlink the only authentication method');
    }
    await (this.prisma as any).authProvider.deleteMany({
      where: { userId, provider },
    });
    this.logger.log(`Unlinked ${provider} from userId ${userId}`);
  }

  async getUserProviders(userId: BigInt): Promise<Array<{ provider: string; email: string | null; displayName: string | null }>> {
    const rows = await (this.prisma as any).authProvider.findMany({
      where: { userId },
      select: { provider: true, email: true, displayName: true },
    });
    return rows;
  }

  // ─── Token issuance ────────────────────────────────────────────────────────

  async issueTokens(userId: BigInt, ip?: string, userAgent?: string): Promise<TokenPair> {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const accessToken = jwt.sign({ sub: String(userId), type: 'access' }, secret, { expiresIn: ACCESS_TOKEN_TTL_S, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE });

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);
    const family = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000);

    await (this.prisma as any).webSession.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        family,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: ACCESS_TOKEN_TTL_S };
  }

  // ─── Token verification ────────────────────────────────────────────────────

  verifyAccessToken(token: string): { userId: BigInt } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as { sub: string; type: string };
      if (payload.type !== 'access') throw new UnauthorizedException('Wrong token type');
      return { userId: BigInt(payload.sub) };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  // ─── Refresh token rotation (with theft detection) ─────────────────────────

  async rotateRefreshToken(rawRefresh: string, ip?: string, userAgent?: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefresh);

    const session = await (this.prisma as any).webSession.findUnique({ where: { tokenHash } });

    if (!session) throw new UnauthorizedException('Unknown refresh token');

    if (session.revokedAt || session.expiresAt < new Date()) {
      // Token already used or expired — if it has a family, revoke the entire family (theft detected)
      if (session.family) {
        await this.revokeFamilyExcept(session.family, null);
        this.logger.warn(`Refresh token reuse detected — revoked family ${session.family} for userId ${session.userId}`);
      }
      throw new UnauthorizedException('Refresh token already used or expired');
    }

    // Mark this token as used
    await (this.prisma as any).webSession.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    // Issue new token in the same family
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const accessToken = jwt.sign({ sub: String(session.userId), type: 'access' }, secret, { expiresIn: ACCESS_TOKEN_TTL_S, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE });

    const newRaw = crypto.randomBytes(40).toString('hex');
    const newHash = this.hashToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000);

    await (this.prisma as any).webSession.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.userId,
        tokenHash: newHash,
        family: session.family,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    return { accessToken, refreshToken: newRaw, expiresIn: ACCESS_TOKEN_TTL_S };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async revokeSession(rawRefresh: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefresh);
    await (this.prisma as any).webSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: BigInt): Promise<void> {
    await (this.prisma as any).webSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async revokeFamilyExcept(family: string, exceptHash: string | null): Promise<void> {
    await (this.prisma as any).webSession.updateMany({
      where: {
        family,
        revokedAt: null,
        ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  private generateWebUserId(): BigInt {
    // Random BigInt in [WEB_USER_ID_MIN, WEB_USER_ID_MAX) — safe from Telegram ID collisions
    const range = WEB_USER_ID_MAX - WEB_USER_ID_MIN;
    const rand = BigInt('0x' + crypto.randomBytes(8).toString('hex')) % range;
    return WEB_USER_ID_MIN + rand;
  }
}
