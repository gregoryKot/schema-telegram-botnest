import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import { decryptRecord } from '../utils/crypto';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import { introLeadMessages, normalizeIntroLead } from './intro-lead.format';
import { IntroLeadService } from './intro-lead.service';

const DAY_MS = 86_400_000;
// Повтор берёт заявки, у которых не дошёл НИ один канал; свежее 5 минут не
// трогает (первая отправка может быть ещё в полёте), старше 7 дней бросает.
const RETRY_MIN_AGE_MS = 5 * 60_000;
const RETRY_MAX_AGE_MS = 7 * DAY_MS;
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BATCH = 20;

/**
 * Повтор доставки заявок с формы знакомства (правило №17: аренда прогона).
 * Без него строка при мёртвых каналах только писалась бы, а читать её некому:
 * у владельца нет ни UI, ни доступа к базе на Amvera.
 */
@Injectable()
export class IntroLeadRedeliveryService {
  private readonly logger = new Logger(IntroLeadRedeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLeader: CronLeaderService,
    private readonly introLead: IntroLeadService,
  ) {}

  /** Повтор доставки: заявки, до которых не дошёл ни один канал. */
  @Cron('*/15 * * * *', { name: 'introLeadRedelivery' })
  async redeliver(now = new Date()): Promise<number> {
    if (
      !(await this.cronLeader.claimRun(
        'introLeadRedelivery',
        LEASE_WINDOW.fifteenMinutes,
        now,
      ))
    ) {
      this.logger.log('introLeadRedelivery: тик забрал другой инстанс');
      return 0;
    }
    try {
      const rows = await this.prisma.introLead.findMany({
        where: {
          tgDeliveredAt: null,
          emailDeliveredAt: null,
          anonymizedAt: null,
          deliveryAttempts: { lt: RETRY_MAX_ATTEMPTS },
          createdAt: {
            gt: new Date(now.getTime() - RETRY_MAX_AGE_MS),
            lt: new Date(now.getTime() - RETRY_MIN_AGE_MS),
          },
        },
        orderBy: { createdAt: 'asc' },
        take: RETRY_BATCH,
      });
      let resent = 0;
      for (const row of rows) {
        // Счётчик — до отправки: падение посреди не даст слать вечно.
        await this.prisma.introLead.update({
          where: { id: row.id },
          data: { deliveryAttempts: { increment: 1 } },
        });
        const plain = decryptRecord(row, INTRO_LEAD_SCHEMA);
        const lead = normalizeIntroLead({
          name: plain.clientName,
          contact: plain.clientContact,
          channel: plain.clientChannel ?? undefined,
          message: plain.message ?? undefined,
          source: plain.source ?? undefined,
        });
        if (!lead) continue;
        await this.introLead.deliver(row.id, introLeadMessages(lead, 'repeat'));
        resent++;
      }
      return resent;
    } catch (err) {
      this.logger.error('intro lead redelivery failed', err as Error);
      return 0;
    }
  }
}
