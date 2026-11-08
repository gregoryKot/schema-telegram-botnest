// E16 (аудит 2026-11): двойной тап часа в /settings — два напоминания.
// Telegraf обрабатывает пачку апдейтов параллельно, и две перепланировки шли
// вперемешку: «снять, снять, поставить, поставить». Сценарий — через
// настоящие обработчик, сервис расписания и планировщик; подделана только
// очередь уведомлений (в памяти, с честной асинхронностью).
import { Logger } from '@nestjs/common';
import { TelegramSettingsService } from './telegram.settings.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { NotificationPlannerService } from '../notification/notification.planner.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

interface Row {
  type: string;
  sendAt: Date;
  cancelled: boolean;
}

/** Очередь уведомлений в памяти: каждый вызов — отдельный «запрос к БД». */
function memoryQueue() {
  const rows: Row[] = [];
  const db = () => new Promise((r) => setImmediate(r));
  const pending = (type: string) =>
    rows.filter((r) => r.type === type && !r.cancelled);
  const cancel = async (_u: bigint, type: string) => {
    await db();
    for (const r of pending(type)) r.cancelled = true;
  };
  const schedule = async (_u: bigint, type: string, sendAt: Date) => {
    await db();
    rows.push({ type, sendAt, cancelled: false });
  };
  return {
    rows,
    pending,
    svc: {
      hasPending: async (_u: bigint, type: string) => {
        await db();
        return pending(type).length > 0;
      },
      cancel,
      schedule,
      // Без лока базы — два запроса вперемешку: порядок здесь держит только
      // очередь процесса (межинстансовый лок — replace-pending.ts).
      replacePending: async (u: bigint, type: string, sendAt: Date) => {
        await cancel(u, type);
        await schedule(u, type, sendAt);
      },
      cancelProactive: jest.fn(),
    },
  };
}

function setup() {
  let settings = {
    notifyEnabled: true,
    notifyReminderEnabled: true,
    notifySummaryEnabled: true,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyNextRemindDate: '2020-01-01', // давно пора — перепланировка ставит
    notifyFrequency: 0,
    notifyQuietStart: 23,
    notifyQuietEnd: 7,
    notifyGamified: false,
    notifyPausedUntil: null,
    addressForm: 'ty',
  };
  const botService = {
    getUserSettings: async () => ({ ...settings }),
    updateUserSettings: async (_u: bigint, patch: object) => {
      settings = { ...settings, ...patch };
    },
    getNeeds: () => [],
  };
  const queue = memoryQueue();
  const planner = new NotificationPlannerService(
    queue.svc as never,
    { nextReminderSeq: async () => 1 } as never,
    botService as never,
    {
      getConsecutiveDays: async () => 0,
      getWeeklyStats: async () => [],
      getHistoryRatings: async () => [],
    } as never,
    {} as never,
  );
  const schedule = new TelegramScheduleService(
    null,
    botService as never,
    {} as never,
    {} as never,
    {} as never,
    queue.svc as never,
    {} as never,
    planner,
    {} as never,
  );
  const fakeBot = makeFakeBot();
  new TelegramSettingsService(
    fakeBot.bot,
    botService as never,
    { canonicalUserId: async (id: number) => BigInt(id) } as never,
    queue.svc as never,
    schedule,
  ).onModuleInit();
  return { fakeBot, queue };
}

describe('/settings: двойной тап часа (E16)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('два одновременных тапа — в очереди одно напоминание', async () => {
    const { fakeBot, queue } = setup();

    await Promise.all([
      runAction(fakeBot, 'settings:hour:20'),
      runAction(fakeBot, 'settings:hour:20'),
    ]);

    expect(queue.pending('reminder')).toHaveLength(1);
  });

  it('тапы разных часов — одно напоминание, на последний выбранный час', async () => {
    const { fakeBot, queue } = setup();

    await Promise.all([
      runAction(fakeBot, 'settings:hour:9'),
      runAction(fakeBot, 'settings:hour:20'),
    ]);

    const [only] = queue.pending('reminder');
    expect(queue.pending('reminder')).toHaveLength(1);
    // 20:00 МСК = 17:00 UTC: выигрывает настройка, записанная последней.
    expect(only.sendAt.getUTCHours()).toBe(17);
  });
});
