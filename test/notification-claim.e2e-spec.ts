// Захват строки очереди уведомлений на РЕАЛЬНОМ Postgres (аудит 2026-10,
// backend#15; src/notification/notification-claim.ts).
//
// Прогон, переживший kill-таймер, и следующий тик (или два инстанса) читают
// одни и те же неотправленные строки. Защита держится на атомарности одного
// UPDATE с условием: из параллельных захватов строку получает ровно один.
// Это свойство Postgres, а не нашего кода — фейк ответит что угодно (правила
// №17, №18). Поэтому здесь два настоящих прогона очереди (`runProcessQueue`
// с настоящим NotificationService) идут одновременно по одной базе, и каждое
// уведомление обязано уйти ровно один раз. Шов «kill-таймер → следующий тик»
// на фейковых часах — src/telegram/telegram.schedule-queue.claim.spec.ts.
import { Logger } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  NotificationService,
  type DueNotification,
} from '../src/notification/notification.service';
import {
  CLAIM_WINDOW_MS,
  claimForSend,
} from '../src/notification/notification-claim';
import { loadSendSettings } from '../src/bot/send-settings.load';
import { runProcessQueue } from '../src/telegram/telegram.schedule-queue';
import { RejectCounter } from '../src/telegram/telegram.schedule-queue.rejects';

// Телеграмный диапазон (ниже WEB_USER_ID_MIN): адрес — сам номер.
const USERS = [773_000_001n, 773_000_002n, 773_000_003n];
const PER_USER = 8;

/** Очередь видит только строки этого спека, а не всю общую базу джобы. */
class ScopedNotifications extends NotificationService {
  async getDue(): Promise<DueNotification[]> {
    return (await super.getDue()).filter((r) => USERS.includes(r.userId));
  }
}

describe('захват строки очереди уведомлений на живом Postgres', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    for (const id of USERS) await prisma.user.create({ data: { id } });
  });

  afterEach(async () => {
    await prisma.scheduledNotification.deleteMany({
      where: { userId: { in: USERS } },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    await prisma.$disconnect();
  });

  const due = (userId: bigint, text: string) =>
    prisma.scheduledNotification.create({
      data: {
        userId,
        type: 'summary',
        sendAt: new Date(Date.now() - 60_000),
        payload: { text },
      },
    });

  it('десять одновременных захватов одной строки — ровно один успешный', async () => {
    const { id } = await due(USERS[0], 'один');
    const wins = await Promise.all(
      Array.from({ length: 10 }, () => claimForSend(prisma, id)),
    );
    expect(wins.filter(Boolean)).toHaveLength(1);
    const row = await prisma.scheduledNotification.findUnique({
      where: { id },
    });
    expect(row?.attemptedAt).toBeInstanceOf(Date);
  });

  it('свежий захват держит строку, захват старше окна — нет', async () => {
    const { id } = await due(USERS[0], 'окно');
    const t0 = new Date();
    expect(await claimForSend(prisma, id, t0)).toBe(true);
    const soon = new Date(t0.getTime() + CLAIM_WINDOW_MS - 1_000);
    expect(await claimForSend(prisma, id, soon)).toBe(false);
    const later = new Date(t0.getTime() + CLAIM_WINDOW_MS + 1_000);
    expect(await claimForSend(prisma, id, later)).toBe(true);
  });

  it('отправленную, снятую и отпущенную строку захват видит правильно', async () => {
    const notifications = new NotificationService(prisma);
    const sent = await due(USERS[1], 'ушло');
    await notifications.markSent(sent.id);
    expect(await notifications.claim(sent.id)).toBe(false);

    const cancelled = await due(USERS[1], 'снято');
    await notifications.cancelOne(cancelled.id);
    expect(await notifications.claim(cancelled.id)).toBe(false);

    const retry = await due(USERS[1], 'повтор');
    expect(await notifications.claim(retry.id)).toBe(true);
    await notifications.releaseClaim(retry.id);
    expect(await notifications.claim(retry.id)).toBe(true);
  });

  it('два прогона очереди одновременно — каждое уведомление уходит один раз', async () => {
    for (const userId of USERS)
      for (let i = 0; i < PER_USER; i++) await due(userId, `${userId}:${i}`);

    // Тексты шаблонов статичны — строки различаем по адресату (chat_id).
    const chats: string[] = [];
    // Telegram отвечает не мгновенно: прогоны успевают перемешаться.
    const callApi = jest.fn(async (_m: string, p: { chat_id: unknown }) => {
      await new Promise((r) => setTimeout(r, 5));
      chats.push(String(p.chat_id));
      return { message_id: chats.length };
    });
    const run = () =>
      runProcessQueue({
        bot: { telegram: { callApi } } as never,
        accountService: {
          getSendSettingsFor: (ids: bigint[]) => loadSendSettings(prisma, ids),
        } as never,
        notificationService: new ScopedNotifications(prisma),
        logger: new Logger('e2e-queue'),
        pace: { pauseMs: 0 },
        rejects: new RejectCounter(),
      });

    await Promise.all([run(), run()]);

    // Ровно PER_USER отправок на человека: повторной отправки нет.
    const expected = USERS.flatMap((u) =>
      Array.from({ length: PER_USER }, () => String(u)),
    );
    expect([...chats].sort()).toEqual([...expected].sort());
    const left = await prisma.scheduledNotification.count({
      where: { userId: { in: USERS }, sentAt: null },
    });
    expect(left).toBe(0);
  });
});
