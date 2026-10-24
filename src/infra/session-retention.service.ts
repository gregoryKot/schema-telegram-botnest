import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Ретеншен (D-9, аудит 2026-10): строки входа, которые уже никому не нужны,
// копились вечно, а в них IP, User-Agent и (у EmailToken) адрес почты.
//   WebSession — отозвана ИЛИ истекла больше 30 дней назад. Месяц запаса: по
//     свежей отозванной строке ловится повторное предъявление украденного
//     токена (refresh-theft), после месяца токен всё равно просрочен.
//   EmailToken — истёк ИЛИ использован больше 7 дней назад: одноразовая
//     ссылка живёт минуты, неделя нужна только для разбора жалоб «ссылка не
//     пришла».
//
// Без leader-election (scripts/cron-leader-baseline.json — `exempt`):
// deleteMany идемпотентен, второй инстанс на том же тике удалит 0 строк.
const DAY_MS = 86_400_000;
export const SESSION_RETENTION_DAYS = 30;
export const EMAIL_TOKEN_RETENTION_DAYS = 7;

@Injectable()
export class SessionRetentionService {
  private readonly logger = new Logger(SessionRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('23 4 * * *', { name: 'sessionRetention' })
  async cleanup(
    now = new Date(),
  ): Promise<{ sessions: number; tokens: number }> {
    const sessionCutoff = new Date(
      now.getTime() - SESSION_RETENTION_DAYS * DAY_MS,
    );
    const tokenCutoff = new Date(
      now.getTime() - EMAIL_TOKEN_RETENTION_DAYS * DAY_MS,
    );
    try {
      const sessions = await this.prisma.webSession.deleteMany({
        where: {
          OR: [
            { revokedAt: { lt: sessionCutoff } },
            { expiresAt: { lt: sessionCutoff } },
          ],
        },
      });
      const tokens = await this.prisma.emailToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: tokenCutoff } },
            { usedAt: { lt: tokenCutoff } },
          ],
        },
      });
      if (sessions.count > 0 || tokens.count > 0)
        this.logger.log(
          `ретеншен: удалено сессий ${sessions.count}, токенов почты ${tokens.count}`,
        );
      return { sessions: sessions.count, tokens: tokens.count };
    } catch (err) {
      // Ошибка в stdout вторым аргументом: первый уходит админу в DM.
      this.logger.error('session retention failed', err as Error);
      return { sessions: 0, tokens: 0 };
    }
  }
}
