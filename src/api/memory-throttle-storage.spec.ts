// Аудит 2026-10-11: штатный ThrottlerStorageService (@nestjs/throttler 6.5.0)
// при снятии блока ОДНОГО ключа отменяет таймеры истечения хитов ВСЕХ ключей
// того же троттлера (`clearExpirationTimes(throttlerName)`), а записи из Map не
// удаляет никогда. Прод считает немаркированные ключи в MemoryThrottleStorage
// (без таймеров); время здесь фейковое: Jest 30 мокает и Date.now.
import { ThrottlerStorageService } from '@nestjs/throttler';
import { HybridThrottleStorage } from './hybrid-throttle-storage';
import { MemoryThrottleStorage, SWEEP_MS } from './memory-throttle-storage';

type Store = Pick<ThrottlerStorageService, 'increment'>;
const TTL = 1000;
const hit = (s: Store, key: string, limit = 10, ttl = TTL, block = ttl) =>
  s.increment(key, ttl, limit, block, 'short');

/**
 * Сценарий находки: хит A; B исчерпывает лимит 0 и блокируется на 50 мс; блок
 * истекает, B делает хит (сброс блока); проходит ttl; хит A. Возвращает
 * totalHits A: честный ответ 1 (старый хит A уже истёк).
 */
async function crossKeyScenario(s: Store): Promise<number> {
  await hit(s, 'A');
  expect((await hit(s, 'B', 0, TTL, 50)).isBlocked).toBe(true);
  jest.advanceTimersByTime(60);
  await hit(s, 'B', 0, TTL, 50); // блок истёк: сброс ключа B
  jest.advanceTimersByTime(TTL);
  return (await hit(s, 'A')).totalHits;
}

describe('MemoryThrottleStorage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('снятие блока одного ключа не трогает хиты других', () => {
    it('хит A истекает через ttl, хотя у B снялся блок', async () => {
      expect(await crossKeyScenario(new MemoryThrottleStorage())).toBe(1);
    });

    it('то же через HybridThrottleStorage (шов: так подключено в ThrottlerModule)', async () => {
      const hybrid = new HybridThrottleStorage({} as never);
      expect(await crossKeyScenario(hybrid)).toBe(1);
    });

    it('КОНТРОЛЬ: штатное хранилище с 6.6.0 считает тот же сценарий верно (1)', async () => {
      // На 6.5.0 здесь было 2 (дефект из шапки файла). В 6.6.0 апстрим
      // перевёл clearExpirationTimes на ключ, в 6.7.0 добавил выметание
      // записей — замена больше не обязательна; возврат на штатное хранилище
      // и удаление MemoryThrottleStorage — строка в docs/open/backend.md.
      // Покраснеет, если дефект вернётся в новой версии библиотеки.
      const lib = new ThrottlerStorageService();
      expect(await crossKeyScenario(lib)).toBe(1);
      lib.onApplicationShutdown();
    });
  });

  describe('дифференциально: на одном ключе совпадает со штатным', () => {
    type Step = { advance: number; limit: number; ttl: number; block: number };
    // ThrottlerGuard читает timeToBlockExpire только при isBlocked (Retry-After);
    // у незаблокированного ключа это остаток от прошлого блока или от нуля
    // времени (после выметания записи) — шум, который не сравниваем.
    const visible = (r: Awaited<ReturnType<Store['increment']>>) =>
      r.isBlocked ? r : { ...r, timeToBlockExpire: null };
    const run = async (
      s: Store,
      steps: Step[],
    ): Promise<Awaited<ReturnType<Store['increment']>>[]> => {
      const out = [];
      for (const st of steps) {
        jest.advanceTimersByTime(st.advance);
        out.push(await hit(s, 'K', st.limit, st.ttl, st.block));
      }
      return out;
    };
    const seq = (limit: number, ttl: number, block: number): Step[] => {
      const gaps = [
        0, 100, 100, 100, 100, 0, 0, 300, 400, 400, 1200, 0, 0, 0, 0, 0, 200,
        61_000, 0, 0, 5000, 0, 70_000, 0,
      ];
      return gaps.map((advance) => ({ advance, limit, ttl, block }));
    };

    it.each([
      ['short: окно 1с, лимит 3, блок = ttl', 3, 1000, 1000],
      ['long: окно 60с, лимит 5, блок = ttl', 5, 60_000, 60_000],
      ['блок длиннее окна', 2, 1000, 4000],
      ['блок короче окна', 4, 3000, 700],
    ])('%s', async (_name, limit, ttl, block) => {
      const steps = seq(limit, ttl, block);
      jest.setSystemTime(1_000_000);
      const mine = await run(new MemoryThrottleStorage(), steps);
      jest.setSystemTime(1_000_000);
      const lib = new ThrottlerStorageService();
      const theirs = await run(lib, steps);
      lib.onApplicationShutdown();
      expect(mine.map(visible)).toEqual(theirs.map(visible));
      expect(mine.some((r) => r.isBlocked)).toBe(true);
      expect(mine.some((r) => !r.isBlocked && r.totalHits > 1)).toBe(true);
    });
  });

  describe('удаление записей и таймеры', () => {
    it('истёкшие записи уходят при выметании, живая остаётся', async () => {
      const s = new MemoryThrottleStorage();
      for (let i = 0; i < 50; i++) await hit(s, `old-${i}`);
      expect(s.size).toBe(50);
      jest.advanceTimersByTime(TTL + SWEEP_MS);
      await hit(s, 'fresh');
      expect(s.size).toBe(1);
    });

    it('ключ с действующим блоком не удаляется досрочно, истёкший — удаляется', async () => {
      const s = new MemoryThrottleStorage();
      await hit(s, 'blocked', 0, TTL, 3 * SWEEP_MS);
      jest.advanceTimersByTime(SWEEP_MS + TTL);
      await hit(s, 'other');
      expect(s.size).toBe(2);
      expect((await hit(s, 'blocked', 0, TTL, 3 * SWEEP_MS)).isBlocked).toBe(
        true,
      );
      jest.advanceTimersByTime(3 * SWEEP_MS);
      await hit(s, 'other');
      expect(s.size).toBe(1);
    });

    it('таймеров нет вовсе, даже на часовом ttl', async () => {
      const s = new MemoryThrottleStorage();
      await hit(s, 'slot', 6, 3_600_000);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('reset() стирает все счётчики', async () => {
      const s = new MemoryThrottleStorage();
      await hit(s, 'a');
      s.reset();
      expect(s.size).toBe(0);
      expect((await hit(s, 'a')).totalHits).toBe(1);
    });
  });
});
