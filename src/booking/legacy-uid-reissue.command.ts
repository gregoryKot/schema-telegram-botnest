import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { TELEGRAF_BOT } from '../telegram/telegram.constants';
import { registerBackgroundAdminCommand } from './admin-background-command';
import { anonymizeCutoff } from './booking-retention.service';
import { CalDavService } from './caldav.service';
import {
  EVENT_KEPT,
  formatReissueReport,
  REISSUE_COMMAND,
  ReissuePorts,
  runLegacyUidReissue,
} from './legacy-uid-reissue';

// /reissue_icloud — сухой прогон, /reissue_icloud go — боевой (только ADMIN_ID).
// Брони в сроке хранения (будущие и за последние 12 мес.), у которых могло
// быть событие; старше срока событие удаляет /scrub_foreign.
@Injectable()
export class LegacyUidReissueCommand implements OnModuleInit {
  private readonly logger = new Logger(LegacyUidReissueCommand.name);
  /** Пауза между запросами: iCloud режет частые вызовы. */
  pauseMs = 400;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calDav: CalDavService,
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
  ) {}

  onModuleInit() {
    registerBackgroundAdminCommand(this.bot, this.logger, {
      name: REISSUE_COMMAND,
      busy: '⏳ Перевыпуск уже идёт — итог придёт отдельным сообщением.',
      failed: '❌ Перевыпуск оборвался, подробности в логах. Повтор безопасен.',
      run: (live) => this.report(live),
    });
  }

  async report(live: boolean, now = new Date()): Promise<string> {
    if (!this.calDav.enabled) return formatReissueReport(null);
    const bookings = await this.prisma.booking.findMany({
      where: {
        startsAt: { gte: anonymizeCutoff(now) },
        // Событие могло появиться — те же признаки, что у cancelEventUid.
        OR: [
          { calDavUid: { not: null } },
          { status: { in: EVENT_KEPT } },
          { paidAt: { not: null } },
          { meetingUrl: { not: null } },
        ],
      },
      select: {
        id: true,
        startsAt: true,
        durationMin: true,
        type: true,
        status: true,
        calDavUid: true,
      },
      orderBy: { id: 'asc' },
    });
    const r = await runLegacyUidReissue({
      bookings,
      live,
      ports: this.ports(),
    });
    this.logger.log(`${REISSUE_COMMAND} ${JSON.stringify(r)}`);
    return formatReissueReport(r);
  }

  private ports(): ReissuePorts {
    return {
      putEvent: (ev) => this.calDav.pushEvent(ev),
      removeEvent: (uid) => this.calDav.removeEvent(uid),
      saveUid: async (id, from, to) => {
        const saved = await this.prisma.booking.updateMany({
          where: { id, calDavUid: from, status: { in: EVENT_KEPT } },
          data: { calDavUid: to },
        });
        return saved.count === 1;
      },
      pause: () => new Promise((done) => setTimeout(done, this.pauseMs)),
    };
  }
}
