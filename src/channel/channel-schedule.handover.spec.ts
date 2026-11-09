// Хвост волны 8 (аудит 2026-11): у слота два механизма повтора. Слот не вышел
// нигде, исход у всех известен (`posted: false`) — тик через 5 минут повторял
// публикацию новой фразой, а досылка в ту же минуту слала старую фразу тем же
// площадкам: у ожившей площадки выходило два поста.
//
// Здесь настоящие расписание и publisher, а площадки, журнал и история постов —
// в памяти: проигрывается всё утро, тик за тиком, как идут кроны.
import { Logger } from '@nestjs/common';
import { ChannelScheduleService } from './channel-schedule.service';
import { ChannelPublisherService } from './channel-publisher.service';
import type { ChannelTarget } from './channel-target';
import type { DeliveryRow } from './delivery-log.format';
import type { DeliveryLogService } from './delivery-log.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { CronLeaderService } from '../infra/cron-leader.service';
import { plannedOffset } from '../bot/healthy-adult.schedule';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const DAY = '2026-07-13';
// МСК = UTC+3.
const msk = (h: number, m: number) => new Date(Date.UTC(2026, 6, 13, h - 3, m));
/** Первый тик слота: ближайшая пятиминутка не раньше запланированной минуты. */
const FIRST = Math.ceil(plannedOffset(DAY, 'morning') / 5) * 5;
const firstTick = msk(9, FIRST);

type Alive = (at: Date) => boolean;

function world(alive: Record<string, Alive>) {
  let clock = msk(9, 0);
  let phraseNo = 0;
  let lastPost: Date | null = null;
  const rows: DeliveryRow[] = [];
  const posts: { platform: string; text: string }[] = [];
  const step = () => new Promise((r) => setImmediate(r));

  const targets: ChannelTarget[] = Object.keys(alive).map((platform) => ({
    platform,
    title: platform,
    envKey: `ENV_${platform}`,
    destination: () => '@ch',
    send: async (post) => {
      await step();
      // Точный отказ площадки: запрос не прошёл, исход известен.
      if (!alive[platform](clock)) throw new Error('403: нет прав');
      posts.push({ platform, text: post.text });
    },
    explain: (err) => (err as Error).message,
  }));
  const phrases = {
    recentPostTexts: async () => [],
    pickFromPool: async () => `фраза ${++phraseNo}`,
    recordPost: async () => {
      lastPost = clock;
    },
    lastPostAt: async () => lastPost,
    poolStatus: async () => ({ enabled: 40, unused: 30, daysLeft: 15 }),
  } as unknown as HealthyAdultService;
  const journal = {
    record: async (
      source: string,
      ok: { platform: string }[],
      bad: { platform: string; reason: string }[],
      text?: string,
    ) => {
      await step();
      const at = clock;
      for (const d of ok)
        rows.unshift({ ...base(source, d.platform, text, at), ok: true });
      for (const f of bad)
        rows.unshift({
          ...base(source, f.platform, text, at),
          reason: f.reason,
        });
    },
    slotRows: async (source: string, since: Date) => {
      await step();
      return rows.filter(
        (r) => r.source.startsWith(source) && r.createdAt >= since,
      );
    },
  } as unknown as DeliveryLogService;
  const publisher = new ChannelPublisherService(targets, phrases, journal);
  const schedule = new ChannelScheduleService(publisher, phrases, journal, {
    claimRun: async () => true,
  } as unknown as CronLeaderService);

  /** Утро как у кронов: тик раз в 5 минут в окне, досылка раз в 15 — до обеда. */
  async function runMorning() {
    for (let t = msk(9, 0); t <= msk(13, 0); t = new Date(+t + 5 * 60_000)) {
      clock = t;
      const quarter = t.getUTCMinutes() % 15 === 0;
      const inWindow = t < msk(11, 0);
      await Promise.all([
        inWindow ? schedule.maybePost(t) : null,
        quarter ? schedule.catchUp(t) : null,
      ]);
    }
  }
  const at = (platform: string) =>
    posts.filter((p) => p.platform === platform).map((p) => p.text);
  return { runMorning, at };
}

function base(
  source: string,
  platform: string,
  text: string | undefined,
  at: Date,
) {
  return {
    source,
    platform,
    destination: '@ch',
    ok: false,
    reason: null as string | null,
    text: text ?? null,
    createdAt: at,
  };
}

describe('ChannelScheduleService — один механизм повтора на слот', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('сценарий: следующий тик после первой попытки совпадает с тиком досылки', () => {
    // Без этого совпадения гонки нет и тест ниже ничего не доказывает.
    expect(FIRST % 15).toBe(10);
  });

  it('слот не вышел нигде, площадка ожила — за утро у неё ровно один пост', async () => {
    const w = world({ telegram: (t) => t > firstTick });
    await w.runMorning();
    expect(w.at('telegram')).toHaveLength(1);
  });

  it('площадка мертва всё окно — пост не теряется: досылка после окна', async () => {
    // Раньше досылка жгла три попытки в окне, пока площадка лежала, и к
    // моменту, когда та ожила, повторять было уже нечем.
    const w = world({ telegram: (t) => t >= msk(11, 0) });
    await w.runMorning();
    expect(w.at('telegram')).toEqual(['фраза 3']); // последняя фраза тика
  });

  it('контроль: пост вышел хоть где-то — досылка добивает остальных той же фразой', async () => {
    const w = world({ telegram: () => true, vk: (t) => t > firstTick });
    await w.runMorning();
    expect(w.at('telegram')).toEqual(['фраза 1']);
    expect(w.at('vk')).toEqual(['фраза 1']);
  });
});
