import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import { TelegramService } from '../telegram/telegram.service';
import { decryptRecord } from '../utils/crypto';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import { introLeadMessages, normalizeIntroLead } from './intro-lead.format';
import { IntroLeadService } from './intro-lead.service';

const DAY_MS = 86_400_000;
// Повтор берёт заявки, до которых не дошло письмо (данные человека — только в
// нём); свежее 5 минут не трогает (отправка ещё в полёте), старше 7 дней бросает.
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
    private readonly telegram: TelegramService,
  ) {}

  /** Повтор доставки: заявки, до которых не дошло письмо (DM — если не дошёл и он). */
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
      // Без канала к владельцу (бот, ADMIN_ID) DM не уйдёт, и это не сбой Telegram:
      // заявка без DM ждёт настройки вместе с письмом, попытка не списывается.
      const tgReady = this.telegram.canNotifyAdmin();
      let resent = 0;
      let waiting = 0;
      for (const row of rows) {
        const tgDone = row.tgDeliveredAt != null;
        if (!tgDone && !tgReady) {
          waiting++;
          continue;
        }
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
        const msg = introLeadMessages(lead, row.id, 'repeat');
        await this.introLead.deliver(row.id, msg, tgDone);
        resent++;
      }
      if (waiting > 0)
        this.logger.log(
          `introLeadRedelivery: канала к владельцу нет (бот, ADMIN_ID), ждут заявок: ${waiting}`,
        );
      return resent;
    } catch (err) {
      this.logger.error('intro lead redelivery failed', err as Error);
      return 0;
    }
  }
}
