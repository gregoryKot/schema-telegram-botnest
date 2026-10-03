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

// Погашение magic-link токена вынесено из AuthService отдельным сервисом
// (файл-храповик правила №10 + сюда же сел 2FA-гейт). Выдача токена
// (requestEmailLogin/linkEmailToAccount) осталась в AuthService — она пишет
// EmailToken, а этот сервис его читает.
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

  // Consume a login or link_email_auth token. Returns issued tokens OR a TOTP
  // challenge (2FA-гейт, аудит 2026-08, H1): почтовый ящик — фактор, который
  // TOTP обязан прикрыть, поэтому магик-линк на login при включённом TOTP не
  // выдаёт сессию сразу, а требует код (как OAuth-вход).
  //
  // Привязка (link_email_auth, аудит 2026-10, A3): письмо уходит на адрес,
  // который ввёл ЗАПРОСИВШИЙ, а кликнуть может кто угодно. Поэтому ссылка
  // работает только в браузере с живой сессией аккаунта, для которого она
  // выдана (`currentUserId`), и сессию не выдаёт никогда: раньше жертва,
  // кликнув по присланной злоумышленником ссылке, получала сессию АККАУНТА
  // ЗЛОУМЫШЛЕННИКА. Проверка стоит ДО погашения: чужой клик токен не сжигает.
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
    if (!row.userId) throw new UnauthorizedException('No user bound to token');
    if (row.purpose === 'link_email_auth' && currentUserId !== row.userId)
      throw new LinkSessionRequiredException();

    // L3 аудита 2026-08: погашение атомарно. Проверка row.usedAt выше и update
    // были раздельны — два параллельных запроса с одним токеном проходили
    // проверку оба и выдавали ДВЕ сессии. updateMany с фильтром usedAt:null —
    // CAS: побеждает ровно один, второй получает count=0 и «уже использован».
    const consumed = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0)
      throw new UnauthorizedException('Token already used');

    const rowEmail = decField(row.email) ?? row.email;
    if (row.purpose === 'link_email_auth') {
      // Link email as auth provider to the existing (already-authed) user.
      const result = await this.auth.linkProviderToUser(
        row.userId,
        'email',
        rowEmail,
        rowEmail,
        rowEmail,
      );
      if (!result.ok) {
        throw new ConflictException(
          'Этот email уже привязан к другому аккаунту',
        );
      }
      return { kind: 'linked', purpose: row.purpose, userId: row.userId };
    }

    if (row.purpose === 'login' && (await this.totp.isEnabled(row.userId))) {
      const challengeToken = this.auth.buildTotpChallengeToken(
        row.userId,
        ip,
        userAgent,
      );
      return {
        kind: 'totp_challenge',
        challengeToken,
        purpose: row.purpose,
        userId: row.userId,
      };
    }

    const tokens = await this.auth.issueTokens(row.userId, ip, userAgent);
    return { kind: 'tokens', tokens, purpose: row.purpose, userId: row.userId };
  }
}
