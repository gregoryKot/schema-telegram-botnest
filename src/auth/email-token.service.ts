import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, TokenPair } from './auth.service';
import { TotpService } from './totp.service';
import { LinkSessionRequiredException } from './link-session-required.exception';
// Адрес в EmailToken — PII, шифруется; лукап токена идёт по tokenHash.
import { decrypt as decField } from '../utils/crypto';

// Погашение magic-link токена (правило №10: вынесено из AuthService; выдача
// токена осталась там).
export type EmailConsumeResult =
  | { kind: 'tokens'; tokens: TokenPair; purpose: string; userId: bigint }
  // Привязка почты: сессия НЕ выдаётся (A3) — человек уже вошёл в свой аккаунт.
  | { kind: 'linked'; purpose: 'link_email_auth'; userId: bigint }
  | {
      kind: 'totp_challenge';
      challengeToken: string;
      purpose: string;
      userId: bigint;
    };

@Injectable()
export class EmailTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly totp: TotpService,
  ) {}

  // Погашает login/link_email_auth. Tokens либо TOTP-challenge (H1 аудита
  // 2026-08: ящик — фактор, который TOTP обязан прикрыть).
  // Привязка (A3): работает только в браузере с живой сессией аккаунта, для
  // которого выдана (`currentUserId`), сессию не выдаёт; проверка ДО погашения.
  // Вход (B-16): у токена нового адреса userId=null — User и AuthProvider
  // заводятся ЗДЕСЬ, после доказательства владения ящиком, а не при запросе.
  async consumeEmailToken(
    rawToken: string,
    ip?: string,
    userAgent?: string,
    currentUserId: bigint | null = null,
  ): Promise<EmailConsumeResult> {
    if (!rawToken) throw new UnauthorizedException('Missing token');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const row = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
    });

    if (!row) throw new UnauthorizedException('Token not found');
    if (row.usedAt) throw new UnauthorizedException('Token already used');
    if (row.expiresAt < new Date())
      throw new UnauthorizedException('Token expired');
    if (!['login', 'link_email_auth'].includes(row.purpose))
      throw new UnauthorizedException('Token purpose mismatch');
    if (!row.userId && row.purpose !== 'login')
      throw new UnauthorizedException('No user bound to token');
    if (row.purpose === 'link_email_auth' && currentUserId !== row.userId)
      throw new LinkSessionRequiredException();

    // L3 аудита 2026-08: погашение атомарно (CAS по usedAt:null) — два
    // параллельных запроса с одним токеном не выдают ДВЕ сессии.
    const consumed = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0)
      throw new UnauthorizedException('Token already used');

    const rowEmail = decField(row.email) ?? row.email;
    if (row.purpose === 'link_email_auth' && row.userId) {
      const result = await this.auth.linkProviderToUser(
        row.userId,
        'email',
        rowEmail,
        rowEmail,
        rowEmail,
      );
      if (!result.ok) {
        throw new ConflictException({
          message: 'Этот email уже привязан к другому аккаунту',
          reason: 'email_taken',
        });
      }
      return { kind: 'linked', purpose: row.purpose, userId: row.userId };
    }

    const userId =
      row.userId ??
      (await this.auth.findOrCreateUserByProvider(
        'email',
        rowEmail,
        rowEmail.split('@')[0],
      ));
    if (await this.totp.isEnabled(userId)) {
      const challengeToken = this.auth.buildTotpChallengeToken(
        userId,
        ip,
        userAgent,
      );
      return {
        kind: 'totp_challenge',
        challengeToken,
        purpose: row.purpose,
        userId,
      };
    }

    const tokens = await this.auth.issueTokens(userId, ip, userAgent);
    return { kind: 'tokens', tokens, purpose: row.purpose, userId };
  }
}
