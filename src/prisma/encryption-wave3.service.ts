import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { encryptIfPlain } from '../utils/encrypt-if-plain';

// Волна 3 дошифровки исторических строк (аудит 2026-10, D-9). Коммит с этой
// волной включил шифрование AuthProvider.email/displayName, Booking.meetingUrl и
// ClientMeeting.meetingUrl для НОВЫХ записей; строки, записанные раньше, лежат
// открытым текстом (Zoom-ссылка с `?pwd=` — по ней входят в комнату клиента).
// Тот же приём, что у волны 2 (encryption-wave2.service.ts): внутри
// приложения на старте, один раз, под флагом в BookingSetting.
//
// Отличия от волны 2: пачками по BATCH строк (AuthProvider — все пользователи,
// не одна таблица в память) и обновление условное (`where` содержит старое
// значение): строку, которую приложение успело перезаписать между чтением и
// записью, волна не затрёт устаревшим значением. Строка, ушедшая из-под
// условия, дошифруется на следующем старте — флаг в этом случае не ставится.
const FLAG_KEY = 'encryption_wave3_done';
const BATCH = 500;

@Injectable()
export class EncryptionWave3Service implements OnApplicationBootstrap {
  private readonly logger = new Logger(EncryptionWave3Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    // Ошибка волны не должна ронять прод: данные читаются и в plaintext
    // (decrypt терпим), флаг не ставится — повтор на следующем старте.
    await this.run().catch((e: unknown) =>
      this.logger.error(
        `encryption wave3 failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  /** @returns сколько строк дошифровано (для лога и тестов) */
  async run(): Promise<number> {
    if (!process.env.ENCRYPTION_KEY) return 0; // dev/CI без ключа — не трогаем
    const done = await this.prisma.bookingSetting.findUnique({
      where: { key: FLAG_KEY },
    });
    if (done) return 0;

    const [providers, bookings, meetings] = [
      await this.authProviders(),
      await this.bookings(),
      await this.clientMeetings(),
    ];
    const total = providers + bookings + meetings;

    const now = new Date().toISOString();
    await this.prisma.bookingSetting.upsert({
      where: { key: FLAG_KEY },
      update: { value: now },
      create: { key: FLAG_KEY, value: now },
    });
    this.logger.log(
      `encryption wave3: done, ${total} rows encrypted ` +
        `(authProvider ${providers}, booking ${bookings}, clientMeeting ${meetings})`,
    );
    return total;
  }

  private async authProviders(): Promise<number> {
    let total = 0;
    let after = 0;
    for (;;) {
      const rows = await this.prisma.authProvider.findMany({
        where: {
          id: { gt: after },
          OR: [{ email: { not: null } }, { displayName: { not: null } }],
        },
        orderBy: { id: 'asc' },
        take: BATCH,
        select: { id: true, email: true, displayName: true },
      });
      if (rows.length === 0) return total;
      for (const r of rows) {
        const email = encryptIfPlain(r.email);
        const displayName = encryptIfPlain(r.displayName);
        if (email === r.email && displayName === r.displayName) continue;
        const res = await this.prisma.authProvider.updateMany({
          where: { id: r.id, email: r.email, displayName: r.displayName },
          data: { email, displayName },
        });
        total += res.count;
      }
      after = rows[rows.length - 1].id;
    }
  }

  private async bookings(): Promise<number> {
    let total = 0;
    let after = 0;
    for (;;) {
      const rows = await this.prisma.booking.findMany({
        where: { id: { gt: after }, meetingUrl: { not: null } },
        orderBy: { id: 'asc' },
        take: BATCH,
        select: { id: true, meetingUrl: true },
      });
      if (rows.length === 0) return total;
      for (const r of rows) {
        const meetingUrl = encryptIfPlain(r.meetingUrl);
        if (meetingUrl === r.meetingUrl) continue;
        const res = await this.prisma.booking.updateMany({
          where: { id: r.id, meetingUrl: r.meetingUrl },
          data: { meetingUrl },
        });
        total += res.count;
      }
      after = rows[rows.length - 1].id;
    }
  }

  // Ключ ClientMeeting — строка (sha256 контакта): таблица маленькая (по строке
  // на клиента), читается целиком.
  private async clientMeetings(): Promise<number> {
    let total = 0;
    for (const r of await this.prisma.clientMeeting.findMany({
      select: { clientKey: true, meetingUrl: true },
    })) {
      const meetingUrl = encryptIfPlain(r.meetingUrl);
      if (meetingUrl === r.meetingUrl || meetingUrl === null) continue;
      const res = await this.prisma.clientMeeting.updateMany({
        where: { clientKey: r.clientKey, meetingUrl: r.meetingUrl },
        data: { meetingUrl },
      });
      total += res.count;
    }
    return total;
  }
}
