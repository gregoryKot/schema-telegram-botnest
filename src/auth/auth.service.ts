import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WEB_USER_ID_MIN, WEB_USER_ID_MAX } from './user-id-range';
import { SecurityLogService } from './security-log.service';
import { EmailService } from './email.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
// Адрес в EmailToken — PII, шифруется; лукап токена идёт по tokenHash.
import { encrypt as encField } from '../utils/crypto';
import { sendMagicLink } from './magic-link';
import { issueRotatedPair, type RotatingSession } from './refresh-issue';
import { normalizeAddressForm } from '../notification/address-form';
import { classifyReuse, shouldSkipRotation } from './refresh-rotation';

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

const ACCESS_TOKEN_TTL_S = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_S = 30 * 24 * 3600; // 30 days

// JWT identity — pinned so tokens can't be replayed across services that
// happen to share JWT_SECRET. Existing in-flight access tokens (issued
// before this change) will fail verification once → frontend will hit
// /api/auth/refresh which is DB-backed and continues to work.
const JWT_ISSUER = 'schemehappens.ru';
const JWT_AUDIENCE = 'schemehappens.ru';

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw token — hash is stored in DB
  expiresIn: number; // seconds
  rotated: boolean; // false = кука не меняется, см. refresh-rotation.ts
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

  verifyTelegramWebAppData(initData: string): {
    id: number;
    firstName: string;
  } {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash in initData');
    // Must be 64 hex chars — otherwise Buffer.from(hash,'hex') yields a
    // wrong-length buffer and timingSafeEqual throws RangeError → 500.
    if (!/^[0-9a-f]{64}$/i.test(hash))
      throw new UnauthorizedException('Malformed hash in initData');

    // Check auth_date freshness (allow 1 hour for mini apps — WebApp is long-lived)
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    if (Date.now() / 1000 - authDate > 3600)
      throw new UnauthorizedException('Telegram initData expired');

    // Build check string: all fields except hash, sorted, joined with \n
    params.delete('hash');
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      )
    ) {
      throw new UnauthorizedException('Invalid Telegram WebApp signature');
    }

    // Parse user field (JSON string in initData)
    const userJson = params.get('user');
    if (!userJson) throw new UnauthorizedException('Missing user in initData');
    let user: { id: number; first_name?: string };
    try {
      user = JSON.parse(userJson) as { id: number; first_name?: string };
    } catch {
      throw new UnauthorizedException('Invalid user JSON in initData');
    }

    if (!user.id)
      throw new UnauthorizedException('Missing user id in initData');
    return { id: user.id, firstName: user.first_name ?? '' };
  }

  // ─── Find or create user ───────────────────────────────────────────────────

  // ─── Email magic-link login ───────────────────────────────────────────────

  async requestEmailLogin(
    email: string,
    ticket?: string,
  ): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    // Find or create user — always succeeds so we don't leak existence
    const userId = await this.findOrCreateUserByProvider(
      'email',
      lower,
      lower.split('@')[0],
    );

    // userId только что найден/создан выше — форма обращения уже выбрана.
    await this.sendMagicLink(userId, lower, 'login', 'sendLoginLink', ticket);
    return { ok: true };
  }

  // Send a magic link that links email as auth provider (not a new login).
  // The token has purpose='link_email_auth' so the callback knows what to do.
  async linkEmailToAccount(
    targetUserId: bigint,
    email: string,
  ): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    // Check if already linked to another user
    const taken = await this.prisma.authProvider.findUnique({
      where: { provider_providerId: { provider: 'email', providerId: lower } },
    });
    if (taken && BigInt(taken.userId) !== targetUserId) {
      throw new ConflictException('Этот email уже привязан к другому аккаунту');
    }

    await this.sendMagicLink(
      targetUserId,
      lower,
      'link_email_auth',
      'linkEmailToAccount sendLoginLink',
    );
    return { ok: true };
  }

  // ─── Find or create user ───────────────────────────────────────────────────

  async findOrCreateUserByProvider(
    provider: string,
    providerId: string,
    displayName?: string,
    email?: string,
  ): Promise<bigint> {
    const existing = await this.prisma.authProvider.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    if (existing) {
      // Update display name if changed
      if (displayName) {
        await this.prisma.authProvider.update({
          where: { id: existing.id },
          data: { displayName, email },
        });
      }
      return existing.userId;
    }

    // For Telegram: userId = telegramId (maintains backward compat with bot data)
    // For Google/email: generate a web-only userId in the safe range
    const userId =
      provider === 'telegram' ? BigInt(providerId) : this.generateWebUserId();

    // Upsert User (may already exist for telegram users who used the bot)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: displayName ? { firstName: displayName } : {},
      create: { id: userId, firstName: displayName },
    });

    // Atomic upsert (Postgres INSERT … ON CONFLICT) — the mini-app fires several
    // API requests in parallel on first load; without this they race between the
    // findUnique above and this insert and all-but-one crash on the
    // (provider, providerId) unique constraint.
    const row = await this.prisma.authProvider.upsert({
      where: { provider_providerId: { provider, providerId } },
      update: { displayName, email },
      create: { userId, provider, providerId, displayName, email },
    });

    this.logger.log(
      `New ${provider} auth provider linked to userId ${row.userId}`,
    );
    return row.userId;
  }

  // ─── Account linking (merge two providers to one user) ────────────────────

  async linkProviderToUser(
    userId: bigint,
    provider: string,
    providerId: string,
    displayName?: string,
    email?: string,
  ): Promise<{ ok: true } | { ok: false; conflictUserId: string }> {
    const existing = await this.prisma.authProvider.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });

    if (existing) {
      if (String(existing.userId) === String(userId)) return { ok: true };
      // The other account is real and has its own userId. Caller decides
      // whether to merge.
      return { ok: false, conflictUserId: String(existing.userId) };
    }

    try {
      await this.prisma.authProvider.create({
        data: { userId, provider, providerId, displayName, email },
      });
    } catch (e: unknown) {
      // Race: a concurrent request inserted the same (provider, providerId)
      // between the findUnique above and this create. Re-resolve deterministically
      // instead of crashing on the unique constraint (mirrors the atomic-upsert
      // fix in findOrCreateUserByProvider).
      if ((e as { code?: string }).code === 'P2002') {
        const now = await this.prisma.authProvider.findUnique({
          where: { provider_providerId: { provider, providerId } },
        });
        if (now && String(now.userId) === String(userId)) return { ok: true };
        if (now) return { ok: false, conflictUserId: String(now.userId) };
      }
      throw e;
    }
    this.logger.log(`Linked ${provider} provider to userId ${userId}`);
    return { ok: true };
  }

  // Short-lived signed token used to confirm a merge in the next request
  // (e.g. user must click "Yes, merge" in the UI before destructive work runs).
  buildMergeToken(
    targetUserId: bigint,
    sourceUserId: bigint,
    provider: string,
    providerId: string,
  ): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign(
      {
        kind: 'merge',
        target: String(targetUserId),
        source: String(sourceUserId),
        provider,
        providerId,
      },
      secret,
      {
        expiresIn: 10 * 60,
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );
  }

  verifyMergeToken(token: string): {
    target: bigint;
    source: bigint;
    provider: string;
    providerId: string;
  } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const p = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as {
        kind: string;
        target: string;
        source: string;
        provider: string;
        providerId: string;
      };
      if (p.kind !== 'merge') throw new Error('Wrong token kind');
      return {
        target: BigInt(p.target),
        source: BigInt(p.source),
        provider: p.provider,
        providerId: p.providerId,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired merge token');
    }
  }

  // ─── 2FA challenge token ─────────────────────────────────────────────────
  // Short-lived (5 min) token returned to client after primary auth IF the
  // user has TOTP enabled. The client exchanges it + the TOTP code on
  // /api/auth/2fa/challenge for a real access token.
  buildTotpChallengeToken(
    userId: bigint,
    ip?: string,
    userAgent?: string,
  ): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign(
      {
        kind: 'totp_challenge',
        sub: String(userId),
        ip: ip ?? null,
        ua: (userAgent ?? '').slice(0, 120),
      },
      secret,
      {
        expiresIn: 5 * 60,
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );
  }

  verifyTotpChallengeToken(token: string): {
    userId: bigint;
    ip: string | null;
    ua: string;
  } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const p = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { kind: string; sub: string; ip: string | null; ua: string };
      if (p.kind !== 'totp_challenge') throw new Error('Wrong token kind');
      return { userId: BigInt(p.sub), ip: p.ip ?? null, ua: p.ua ?? '' };
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge token');
    }
  }

  async unlinkProvider(userId: bigint, provider: string): Promise<void> {
    // Don't allow unlinking the last provider — user would lose access
    const all = await this.prisma.authProvider.findMany({
      where: { userId },
    });
    if (all.length <= 1) {
      throw new ConflictException(
        'Cannot unlink the only authentication method',
      );
    }
    await this.prisma.authProvider.deleteMany({
      where: { userId, provider },
    });
    this.logger.log(`Unlinked ${provider} from userId ${userId}`);
  }

  async getUserProviders(userId: bigint): Promise<
    Array<{
      provider: string;
      email: string | null;
      displayName: string | null;
    }>
  > {
    const rows = await this.prisma.authProvider.findMany({
      where: { userId },
      select: { provider: true, email: true, displayName: true },
    });
    return rows;
  }

  // ─── Token issuance ────────────────────────────────────────────────────────

  // Общий для issueTokens/rotateRefreshToken JWT access-токен.
  private signAccessToken(userId: bigint): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign({ sub: String(userId), type: 'access' }, secret, {
      expiresIn: ACCESS_TOKEN_TTL_S,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async issueTokens(
    userId: bigint,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const accessToken = this.signAccessToken(userId);

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);
    const family = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000);

    await this.prisma.webSession.create({
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

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: ACCESS_TOKEN_TTL_S,
      rotated: true, // первая выдача — семантически тоже "новый refresh"
    };
  }

  // ─── Short-lived one-time link token (60s, for OAuth redirect URLs) ─────────

  buildLinkToken(userId: bigint): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return jwt.sign({ sub: String(userId), type: 'link' }, secret, {
      expiresIn: 60,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  verifyLinkToken(token: string): { userId: bigint } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { sub: string; type: string };
      if (payload.type !== 'link')
        throw new UnauthorizedException('Wrong token type');
      return { userId: BigInt(payload.sub) };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired link token');
    }
  }

  // ─── Token verification ────────────────────────────────────────────────────

  verifyAccessToken(token: string): { userId: bigint } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { sub: string; type: string };
      if (payload.type !== 'access')
        throw new UnauthorizedException('Wrong token type');
      return { userId: BigInt(payload.sub) };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  // ─── Refresh token rotation (with theft detection) ─────────────────────────

  async rotateRefreshToken(
    rawRefresh: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefresh);

    const session = await this.prisma.webSession.findUnique({
      where: { tokenHash },
    });

    if (!session) throw new UnauthorizedException('Unknown refresh token');

    // Потерянный ответ vs кража — classifyReuse, refresh-rotation.ts.
    const now = new Date();
    if (session.revokedAt || session.expiresAt < now) {
      const successor = session.replacedByHash
        ? await this.prisma.webSession.findUnique({
            where: { tokenHash: session.replacedByHash },
          })
        : null;
      const verdict = classifyReuse(session, successor, now, session.userId);
      this.logger.warn(verdict.logMessage);
      // recover — наследник цел и не тронут: второго участника нет.
      if (verdict.outcome === 'recover')
        return this.issueRotated(session, rawRefresh, ip, userAgent);
      if (verdict.outcome === 'theft' && session.family) {
        await this.revokeFamilyExcept(session.family, null);
        this.securityLog.log('refresh_token_reuse', {
          userId: session.userId,
          family: session.family,
        });
      }
      throw new UnauthorizedException('Refresh token already used or expired');
    }

    // Ротировали недавно — только access, кука прежняя (rotated:false).
    if (shouldSkipRotation(session.createdAt, now)) {
      return {
        accessToken: this.signAccessToken(session.userId),
        expiresIn: ACCESS_TOKEN_TTL_S,
        refreshToken: rawRefresh,
        rotated: false,
      };
    }
    return this.issueRotated(session, rawRefresh, ip, userAgent);
  }

  /** Тонкая обёртка над refresh-issue.ts: сервис собирает зависимости. */
  private issueRotated(
    session: RotatingSession,
    rawRefresh: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const deps = {
      prisma: this.prisma,
      hashToken: (raw: string) => this.hashToken(raw),
      signAccessToken: (id: bigint) => this.signAccessToken(id),
      accessTtlS: ACCESS_TOKEN_TTL_S,
      refreshTtlS: REFRESH_TOKEN_TTL_S,
    };
    return issueRotatedPair(deps, session, rawRefresh, ip, userAgent);
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async revokeSession(rawRefresh: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefresh);
    await this.prisma.webSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: bigint): Promise<void> {
    await this.prisma.webSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async revokeFamilyExcept(
    family: string,
    exceptHash: string | null,
  ): Promise<void> {
    await this.prisma.webSession.updateMany({
      where: {
        family,
        revokedAt: null,
        ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  private generateWebUserId(): bigint {
    // Random BigInt in [WEB_USER_ID_MIN, WEB_USER_ID_MAX) — safe from Telegram ID collisions
    const range = WEB_USER_ID_MAX - WEB_USER_ID_MIN;
    const rand = BigInt('0x' + crypto.randomBytes(8).toString('hex')) % range;
    return WEB_USER_ID_MIN + rand;
  }
  private async userAddressForm(id: bigint) {
    const owner = await this.prisma.user.findUnique({
      where: { id },
      select: { addressForm: true },
    });
    return normalizeAddressForm(owner?.addressForm);
  }
  // Тонкая обёртка над magic-link.ts: сервис только собирает зависимости.
  private sendMagicLink(
    userId: bigint,
    lower: string,
    purpose: 'login' | 'link_email_auth',
    logLabel: string,
    ticket?: string,
  ): Promise<void> {
    return sendMagicLink(
      {
        prisma: this.prisma,
        webappUrl: this.config.getOrThrow<string>('WEBAPP_URL'),
        encryptEmail: (e) => encField(e) ?? e,
        addressForm: (id) => this.userAddressForm(id),
        send: (email, link, form) =>
          this.emailSvc.sendLoginLink(email, link, form),
        onSendError: (m) => this.logger.error(`${logLabel} failed: ${m}`),
      },
      userId,
      lower,
      purpose,
      ticket,
    );
  }
}
