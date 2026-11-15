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
import { registerBackgroundAdminCommand } from './admin-background-command';
import { CalDavService } from './caldav.service';
import { MeetingService, ZOOM_TOPIC } from './meeting.service';
import { anonymizeCutoff } from './booking-retention.service';
import {
  deleteZoomRoom,
  listZoomMeetings,
  readZoomTopic,
  renameZoomRoom,
} from './zoom-room';
import { linkRefs, RoomRefs } from './zoom-orphans';
import {
  formatScrubReport,
  runForeignScrub,
  ScrubBooking,
  ScrubPorts,
} from './foreign-scrub';

// /scrub_foreign — сухой прогон, /scrub_foreign go — боевой (только ADMIN_ID).
@Injectable()
export class ForeignScrubCommand implements OnModuleInit {
  private readonly logger = new Logger(ForeignScrubCommand.name);
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
    registerBackgroundAdminCommand(this.bot, this.logger, {
      name: 'scrub_foreign',
      busy: '⏳ Чистка уже идёт — итог придёт отдельным сообщением.',
      failed: '❌ Чистка оборвалась, подробности в логах.',
      run: (live) => this.report(live),
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
    const zoomIds = off.zoom ? [] : await this.zoomRoomIds();
    const token = off.zoom ? null : await this.meeting.zoomToken();
    // Без токена OAuth вызов Zoom — исход 'failed', а не исключение.
    const z = <T>(call: (t: string) => Promise<T>, dead: NoInfer<T>) =>
      token ? call(token) : Promise.resolve(dead);
    const ports: ScrubPorts = {
      putEvent: (ev) => this.calDav.pushEvent(ev),
      removeEvent: (uid) => this.calDav.removeEvent(uid),
      readZoomTopic: (id) =>
        z((t) => readZoomTopic(t, id), { result: 'failed' }),
      renameZoomRoom: (id) =>
        z((t) => renameZoomRoom(t, id, ZOOM_TOPIC), 'failed'),
      deleteZoomRoom: (id) => z((t) => deleteZoomRoom(t, id), 'failed'),
      listZoomMeetings: () =>
        z(listZoomMeetings, {
          result: 'failed',
          meetings: [],
          detail: 'нет токена Zoom',
        }),
      roomRefs: () => this.roomRefs(),
      pause: () => new Promise((r) => setTimeout(r, this.pauseMs)),
    };
    return runForeignScrub({
      bookings,
      zoomIds,
      zoomTopic: ZOOM_TOPIC,
      cutoff: anonymizeCutoff(now),
      live,
      findOrphans: !off.zoom,
      ports,
    });
  }

  private async zoomRoomIds(): Promise<string[]> {
    const rooms = await this.prisma.clientMeeting.findMany({
      where: { zoomMeetingId: { not: null } },
      select: { zoomMeetingId: true },
    });
    return rooms.map((m) => m.zoomMeetingId ?? '').filter(Boolean);
  }

  /** Кто держит комнату: строка ClientMeeting или ссылка живой брони. */
  private async roomRefs(): Promise<RoomRefs> {
    const known = new Set(await this.zoomRoomIds());
    const links = await this.prisma.booking.findMany({
      where: { anonymizedAt: null, meetingUrl: { not: null } },
      select: { meetingUrl: true },
    });
    return { known, ...linkRefs(links.map((b) => b.meetingUrl)) };
  }
}
