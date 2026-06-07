import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from './security-log.service';
import { EmailService } from './email.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

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
    private readonly securityLog: SecurityLogService,
    private readonly emailSvc: EmailService,
  ) {}

  // ─── Telegram WebApp initData ──────────────────────────────────────────────

  verifyTelegramWebAppData(initData: string): { id: number; firstName: string } {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash in initData');
    // Must be 64 hex chars — otherwise Buffer.from(hash,'hex') yields a
    // wrong-length buffer and timingSafeEqual throws RangeError → 500.
    if (!/^[0-9a-f]{64}$/i.test(hash)) throw new UnauthorizedException('Malformed hash in initData');

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

  // ─── Email magic-link login ───────────────────────────────────────────────

  async requestEmailLogin(email: string): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    // Find or create user — always succeeds so we don't leak existence
    const userId = await this.findOrCreateUserByProvider('email', lower, lower.split('@')[0]);

    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await (this.prisma as any).emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        email: lower,
        purpose: 'login',
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const base = this.config.getOrThrow<string>('WEBAPP_URL').replace(/\/$/, '');
    const link = `${base}/api/auth/email/callback?token=${raw}`;
    // Fire-and-forget — response is instant even if email delivery is slow
    void this.emailSvc.sendLoginLink(lower, link).catch((err) =>
      this.logger.error(`sendLoginLink failed: ${(err as Error).message}`),
    );

    return { ok: true };
  }

  // Consume a login or link_email_auth token.
  // Returns tokens + purpose so the controller can decide where to redirect.
  async consumeEmailToken(rawToken: string, ip?: string, userAgent?: string): Promise<{
    tokens: TokenPair; purpose: string; userId: bigint;
  }> {
    if (!rawToken) throw new UnauthorizedException('Missing token');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await (this.prisma as any).emailToken.findUnique({ where: { tokenHash } });

    if (!row)                                                     throw new UnauthorizedException('Token not found');
    if (row.usedAt)                                               throw new UnauthorizedException('Token already used');
    if (row.expiresAt < new Date())                               throw new UnauthorizedException('Token expired');
    if (!['login', 'link_email_auth'].includes(row.purpose))      throw new UnauthorizedException('Token purpose mismatch');
    if (!row.userId)                                              throw new UnauthorizedException('No user bound to token');

    await (this.prisma as any).emailToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    if (row.purpose === 'link_email_auth') {
      // Link email as auth provider to the existing (already-authed) user.
      const result = await this.linkProviderToUser(
        row.userId as bigint, 'email', row.email as string, row.email as string, row.email as string,
      );
      if (!result.ok) {
        throw new ConflictException('Этот email уже привязан к другому аккаунту');
      }
    }

    const tokens = await this.issueTokens(row.userId as bigint, ip, userAgent);
    return { tokens, purpose: row.purpose as string, userId: row.userId as bigint };
  }

  // Send a magic link that links email as auth provider (not a new login).
  // The token has purpose='link_email_auth' so the callback knows what to do.
  async linkEmailToAccount(targetUserId: bigint, email: string): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    // Check if already linked to another user
    const taken = await (this.prisma as any).authProvider.findUnique({
      where: { provider_providerId: { provider: 'email', providerId: lower } },
    });
    if (taken && BigInt(taken.userId) !== targetUserId) {
      throw new ConflictException('Этот email уже привязан к другому аккаунту');
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await (this.prisma as any).emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: targetUserId,
        tokenHash,
        email: lower,
        purpose: 'link_email_auth',
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const base = this.config.getOrThrow<string>('WEBAPP_URL').replace(/\/$/, '');
    const link = `${base}/api/auth/email/callback?token=${raw}`;
    void this.emailSvc.sendLoginLink(lower, link).catch((err) =>
      this.logger.error(`linkEmailToAccount sendLoginLink failed: ${(err as Error).message}`),
    );
    return { ok: true };
  }

  // Keep the old name as an alias so nothing breaks if referenced elsewhere
  async consumeEmailLoginToken(rawToken: string, ip?: string, userAgent?: string): Promise<TokenPair> {
    const { tokens } = await this.consumeEmailToken(rawToken, ip, userAgent);
    return tokens;
  }

  // ─── Find or create user ───────────────────────────────────────────────────

  async findOrCreateUserByProvider(
    provider: 'telegram' | 'google' | 'email',
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
    // For Google/email: generate a web-only userId in the safe range
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

  // ─── 2FA challenge token ─────────────────────────────────────────────────
  // Short-lived (5 min) token returned to client after primary auth IF the
  // user has TOTP enabled. The client exchanges it + the TOTP code on
  // /api/auth/2fa/challenge for a real access token.
  buildTotpChallengeToken(userId: BigInt, ip?: string, userAgent?: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign(
      { kind: 'totp_challenge', sub: String(userId), ip: ip ?? null, ua: (userAgent ?? '').slice(0, 120) },
      secret,
      { expiresIn: 5 * 60, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
  }

  verifyTotpChallengeToken(token: string): { userId: bigint; ip: string | null; ua: string } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const p = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as any;
      if (p.kind !== 'totp_challenge') throw new Error('Wrong token kind');
      return { userId: BigInt(p.sub), ip: p.ip ?? null, ua: p.ua ?? '' };
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge token');
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

  // ─── Short-lived one-time link token (60s, for OAuth redirect URLs) ─────────

  buildLinkToken(userId: bigint): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign(
      { sub: String(userId), type: 'link' },
      secret,
      { expiresIn: 60, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
  }

  verifyLinkToken(token: string): { userId: bigint } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as { sub: string; type: string };
      if (payload.type !== 'link') throw new UnauthorizedException('Wrong token type');
      return { userId: BigInt(payload.sub) };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired link token');
    }
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
        this.securityLog.log('refresh_token_reuse', { userId: session.userId, family: session.family });
      }
      throw new UnauthorizedException('Refresh token already used or expired');
    }

    // Issue new token in the same family. The mark-old-as-used + create-new
    // pair MUST be atomic — otherwise a crash between them leaves the user
    // with no valid session at all.
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const accessToken = jwt.sign({ sub: String(session.userId), type: 'access' }, secret, { expiresIn: ACCESS_TOKEN_TTL_S, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE });

    const newRaw = crypto.randomBytes(40).toString('hex');
    const newHash = this.hashToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000);

    await this.prisma.$transaction([
      (this.prisma as any).webSession.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      }),
      (this.prisma as any).webSession.create({
        data: {
          id: crypto.randomUUID(),
          userId: session.userId,
          tokenHash: newHash,
          family: session.family,
          expiresAt,
          ipAddress: ip,
          userAgent,
        },
      }),
    ]);

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
