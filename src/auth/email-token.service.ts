import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LinkSessionRequiredException } from './link-session-required.exception';
// Адрес в EmailToken — PII, шифруется; лукап токена идёт по tokenHash.
import { decrypt as decField } from '../utils/crypto';

// Погашение ссылки привязки почты (правило №10: вынесено из AuthService;
// выдача токена осталась там).
@Injectable()
export class EmailTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  // Гасит только link_email_auth и возвращает userId, к которому привязан
  // адрес. Входа по ссылке на почту нет (решение владельца, ч. 10 ст. 8
  // 149-ФЗ): токен 'login', выписанный раньше, — 401, сессию не даёт.
  // A3: работает только в браузере с живой сессией аккаунта, для которого
  // выдана (`currentUserId`), сессию не выдаёт; проверка ДО погашения.
  async consumeEmailToken(
    rawToken: string,
    currentUserId: bigint | null = null,
  ): Promise<bigint> {
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
    if (row.purpose !== 'link_email_auth')
      throw new UnauthorizedException('Token purpose mismatch');
    if (!row.userId) throw new UnauthorizedException('No user bound to token');
    if (currentUserId !== row.userId) throw new LinkSessionRequiredException();

    // L3 аудита 2026-08: погашение атомарно (CAS по usedAt:null) — два
    // параллельных запроса с одним токеном не привязывают адрес дважды.
    const consumed = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0)
      throw new UnauthorizedException('Token already used');

    const rowEmail = decField(row.email) ?? row.email;
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
    return row.userId;
  }
}
