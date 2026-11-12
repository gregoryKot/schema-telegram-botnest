import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { decrypt as decField } from '../utils/crypto';
import { emailLinkCodeMatches } from './email-link-code';

// Привязка почты кодом из письма (email-link-code.ts): вторая дверь к тому же
// токену `link_email_auth`, что гасит ссылка (EmailTokenService). Сессию не
// выдаёт — человек уже вошёл; ищет только среди живых токенов ЭТОГО аккаунта,
// поэтому чужой код, даже верный, здесь не найдётся.
@Injectable()
export class EmailLinkCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async confirm(userId: bigint, code: string): Promise<void> {
    const rows = await this.prisma.emailToken.findMany({
      where: {
        userId,
        purpose: 'link_email_auth',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const row = rows.find((r) => emailLinkCodeMatches(r.tokenHash, code));
    if (!row) {
      throw new BadRequestException({
        message: 'Код не подошёл или истёк',
        reason: 'email_code_invalid',
      });
    }
    // Погашение атомарно (CAS по usedAt:null), как у ссылки: код и ссылка из
    // одного письма не привязывают дважды.
    const consumed = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new BadRequestException({
        message: 'Код уже использован',
        reason: 'email_code_invalid',
      });
    }
    const email = decField(row.email) ?? row.email;
    const result = await this.auth.linkProviderToUser(
      userId,
      'email',
      email,
      email,
      email,
    );
    if (!result.ok) {
      throw new ConflictException({
        message: 'Этот email уже привязан к другому аккаунту',
        reason: 'email_taken',
      });
    }
  }
}
