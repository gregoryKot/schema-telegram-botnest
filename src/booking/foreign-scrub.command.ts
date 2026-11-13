import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { TELEGRAF_BOT } from '../telegram/telegram.constants';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminSender } from '../utils/admin-alert';
import { CalDavService } from './caldav.service';
import { MeetingService, ZOOM_TOPIC } from './meeting.service';
import { anonymizeCutoff } from './booking-retention.service';
import { readZoomTopic, renameZoomRoom } from './zoom-room';
import {
  formatScrubReport,
  runForeignScrub,
  ScrubBooking,
  ScrubPorts,
} from './foreign-scrub';

// /scrub_foreign — сухой прогон, /scrub_foreign go — боевой (только ADMIN_ID).
// Идёт фоном: проход по площадкам с паузами дольше таймаута обработчика бота.
@Injectable()
export class ForeignScrubCommand implements OnModuleInit {
  private readonly logger = new Logger(ForeignScrubCommand.name);
  private running: Promise<void> | null = null;
  /** Пауза между запросами к площадке: iCloud и Zoom режут частые вызовы. */
  pauseMs = 400;

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly prisma: PrismaService,
    private readonly calDav: CalDavService,
    private readonly meeting: MeetingService,
  ) {}

  onModuleInit() {
    this.bot?.command('scrub_foreign', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        if (this.running) {
          await ctx.reply(
            '⏳ Чистка уже идёт — итог придёт отдельным сообщением.',
          );
          return;
        }
        const live = ctx.message.text.split(/\s+/)[1] === 'go';
        await ctx.reply('⏳ Запущено — итог придёт отдельным сообщением.');
        this.running = this.report(live)
          .then((text) => ctx.reply(text))
          .then(() => undefined)
          .catch(async (err: unknown) => {
            this.logger.error('scrub_foreign failed', err);
            await ctx
              .reply('❌ Чистка оборвалась, подробности в логах.')
              .catch(() => null);
          })
          .finally(() => {
            this.running = null;
          });
      } catch (err) {
        this.logger.error('scrub_foreign command failed', err);
      }
    });
  }

  async report(live: boolean, now = new Date()): Promise<string> {
    const off = { cal: !this.calDav.enabled, zoom: !this.meeting.status.zoom };
    const r = await this.run(live, off, now);
    this.logger.log(`scrub_foreign ${JSON.stringify(r)}`);
    return formatScrubReport(r, off);
  }

  private async run(
    live: boolean,
    off: { cal: boolean; zoom: boolean },
    now: Date,
  ) {
    const bookings = off.cal
      ? []
      : (
          await this.prisma.booking.findMany({
            where: { calDavUid: { not: null } },
            select: {
              id: true,
              startsAt: true,
              durationMin: true,
              type: true,
              status: true,
              calDavUid: true,
            },
            orderBy: { id: 'asc' },
          })
        ).filter((b): b is ScrubBooking => b.calDavUid !== null);
    const rooms = off.zoom
      ? []
      : await this.prisma.clientMeeting.findMany({
          where: { zoomMeetingId: { not: null } },
          select: { zoomMeetingId: true },
        });
    const zoomIds = rooms.map((m) => m.zoomMeetingId ?? '').filter(Boolean);
    const token = zoomIds.length ? await this.meeting.zoomToken() : null;
    const ports: ScrubPorts = {
      putEvent: (ev) => this.calDav.pushEvent(ev),
      removeEvent: (uid) => this.calDav.removeEvent(uid),
      readZoomTopic: (id) =>
        token
          ? readZoomTopic(token, id)
          : Promise.resolve({ result: 'failed' }),
      renameZoomRoom: (id) =>
        token
          ? renameZoomRoom(token, id, ZOOM_TOPIC)
          : Promise.resolve('failed'),
      pause: () => new Promise((r) => setTimeout(r, this.pauseMs)),
    };
    return runForeignScrub({
      bookings,
      zoomIds,
      zoomTopic: ZOOM_TOPIC,
      cutoff: anonymizeCutoff(now),
      live,
      ports,
    });
  }
}
