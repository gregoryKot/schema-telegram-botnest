// Привязка аккаунта мессенджера к существующему (`intent: 'link'`) — тяжёлая
// половина билета: здесь происходит перенос данных, поэтому она отделена от
// жизненного цикла (login-ticket.service.ts) и от входа, где переносить нечего.
//
// Зачем привязка нужна отдельно от входа. У MAX нет входа для сайтов: их
// подпись существует только внутри мини-аппа. Значит человек не может, сидя на
// сайте, нажать «привязать MAX» — начинать приходится с той стороны. А войти
// через Google прямо в мини-аппе нельзя: Google запрещает OAuth во встроенных
// вебвью. Отсюда и родился обмен кодами.
//
// Порядок шагов в approve — не косметика, см. комментарий там.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { MergeService } from '../merge.service';
import { SecurityLogService } from '../security-log.service';
import { LoginTicketService } from './login-ticket.service';
import type { LinkPreview } from './login-ticket.types';

@Injectable()
export class TicketLinkService {
  private readonly logger = new Logger(TicketLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly tickets: LoginTicketService,
  ) {}

  /**
   * Показать, что именно произойдёт, ДО подтверждения.
   *
   * Без этого экрана флоу открыт для фишинга: человека уговаривают ввести код
   * «для проверки безопасности», и он молча отдаёт свой аккаунт.
   */
  async preview(userCode: string, targetUserId: bigint): Promise<LinkPreview> {
    const row = await this.tickets.liveByUserCode(userCode);
    const sameAccount = row.userId === targetUserId;
    const source = row.userId
      ? await this.prisma.authProvider.findFirst({
          where: { userId: row.userId, provider: row.provider },
        })
      : null;
    return {
      provider: row.provider,
      displayName: source?.displayName ?? null,
      sameAccount,
      summary:
        sameAccount || !row.userId
          ? {}
          : await this.merge.summarize(row.userId),
    };
  }

  /** Человек подтвердил. Здесь и происходит перенос. */
  async approve(
    userCode: string,
    targetUserId: bigint,
    ip?: string,
  ): Promise<{ merged: boolean }> {
    const row = await this.tickets.liveByUserCode(userCode);
    if (row.intent !== 'link') {
      throw new BadRequestException('Этот код не для привязки');
    }
    if (row.approvedUserId) throw new BadRequestException('Код уже подтверждён');
    // Запоминаем источник до всякой записи: дальше хозяин строки меняется, и
    // читать его оттуда уже нельзя.
    const sourceUserId = row.userId;

    const approved = { approvedUserId: targetUserId, approvedAt: new Date() };
    if (sourceUserId === null || sourceUserId === targetUserId) {
      // Подтвердили под тем же аккаунтом — переносить нечего.
      await this.prisma.loginTicket.update({
        where: { id: row.id },
        data: approved,
      });
      return { merged: false };
    }

    const source = await this.prisma.authProvider.findFirst({
      where: { userId: sourceUserId, provider: row.provider },
    });

    // Хозяина строки меняем ДО merge. Иначе merge снесёт её вместе с
    // исчезающим аккаунтом (SECURITY_SENSITIVE_TABLES), и приложение,
    // вернувшись за сессией, увидит «код не найден» — при том, что данные уже
    // переехали.
    await this.prisma.loginTicket.update({
      where: { id: row.id },
      data: { userId: targetUserId, ...approved },
    });

    try {
      await this.merge.merge(sourceUserId, targetUserId);
    } catch (err) {
      // Строка уже сменила хозяина — оставлять её годной нельзя.
      await this.prisma.loginTicket.delete({ where: { id: row.id } });
      this.logger.error(
        `ticket merge ${sourceUserId} → ${targetUserId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new BadRequestException(
        'Не удалось объединить аккаунты. Админ уведомлён — попробовать позже.',
      );
    }

    if (source) {
      await this.auth.linkProviderToUser(
        targetUserId,
        row.provider,
        source.providerId,
      );
    }
    this.securityLog.log('merge_confirmed', {
      target: targetUserId,
      source: sourceUserId,
      provider: row.provider,
      ip,
    });
    return { merged: true };
  }
}
