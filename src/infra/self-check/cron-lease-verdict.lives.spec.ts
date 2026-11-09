// Суточный крон при деплоях чаще раза в сутки (аудит 2026-10, «ловится на 4-е
// сутки, а не на 2-е»). Проба прощала тики до старта своего процесса, а при
// таком темпе деплоев два суточных тика никогда не попадали в жизнь одного
// процесса: мёртвый полуночный планировщик краснел только пределом «двое суток
// сверх порога». Теперь тик, на который пришлась жизнь прошлого процесса
// (process-lives.ts), судится так же, как тик своего.
import { hhmm, leaseProblem, TICK_GRACE_MS } from './cron-lease-verdict';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';
import { latestTicks } from './cron-ticks';
import type { ProcessSpan } from './process-lives';

const H = 3_600_000;
const DAILY = CRON_LEASE_REGISTRY.midnightPlanner; // 0 0 * * *
// Тики считаются в зоне процесса (у midnightPlanner своей зоны нет): берём
// их из расписания, а не пишем 00:00 UTC — сьюты гоняются и под Сиднеем.
const [T1] = latestTicks(
  DAILY.cron,
  new Date('2026-11-03T03:00:00Z'),
  DAILY.tz,
)!;
const LAST = T1.getTime(); // последний тик
const PREV = LAST - 24 * H; // предпоследний

/**
 * Деплой каждые 8 часов, начиная через 2 часа после последнего захвата:
 * процесс живёт до следующего деплоя, а последняя его отметка — прогон
 * пробы за час до смерти.
 */
function deploysEvery8h(
  from: number,
  until: number,
): { earlier: ProcessSpan[]; startedAt: number } {
  const earlier: ProcessSpan[] = [];
  let start = from + 2 * H;
  while (start + 8 * H <= until) {
    earlier.push({ from: start, to: start + 7 * H + 60_000 });
    start += 8 * H;
  }
  return { earlier, startedAt: start };
}

const around = (spans: ProcessSpan[], tick: number) =>
  spans.findIndex((s) => s.from < tick && tick < s.to);

describe('leaseProblem — суточный крон и серия деплоев', () => {
  // Последний захват — за тик до предпоследнего; два последних пропущены.
  const runAt = PREV - 24 * H;
  const now = LAST + 3 * H;

  it('прошлые процессы жили в оба тика — сбой на вторые сутки', () => {
    const { earlier, startedAt } = deploysEvery8h(runAt, now);
    expect(leaseProblem(DAILY, { runAt, now, startedAt, earlier })).toBe(
      `два тика подряд не отработали (${hhmm(PREV)} и ${hhmm(LAST)} UTC), последний раз 51 ч назад`,
    );
  });

  it('без памяти о прошлых процессах та же серия молчит (так было до починки)', () => {
    const { startedAt } = deploysEvery8h(runAt, now);
    expect(leaseProblem(DAILY, { runAt, now, startedAt })).toBeNull();
  });

  it('последний тик пришёлся на перерыв между процессами — не судится', () => {
    const { earlier, startedAt } = deploysEvery8h(runAt, now);
    const i = around(earlier, LAST);
    const gap = earlier.map((s, j) =>
      j === i ? { ...s, to: LAST - 30 * 60_000 } : s,
    );
    expect(
      leaseProblem(DAILY, { runAt, now, startedAt, earlier: gap }),
    ).toBeNull();
  });

  it('отметка позже тика, но в пределах ожидания захвата — тик не судится', () => {
    const { earlier, startedAt } = deploysEvery8h(runAt, now);
    const i = around(earlier, LAST);
    const tight = earlier.map((s, j) =>
      j === i ? { ...s, to: LAST + TICK_GRACE_MS - 1 } : s,
    );
    expect(
      leaseProblem(DAILY, { runAt, now, startedAt, earlier: tight }),
    ).toBeNull();
  });

  it('у прошлого процесса в тик лежала база (отказ после тика) — не судится', () => {
    const { earlier, startedAt } = deploysEvery8h(runAt, now);
    const i = around(earlier, LAST);
    // from — поздний из старта и отказа базы (process-lives.ts).
    const outage = earlier.map((s, j) =>
      j === i ? { ...s, from: LAST + 5 * 60_000 } : s,
    );
    expect(
      leaseProblem(DAILY, { runAt, now, startedAt, earlier: outage }),
    ).toBeNull();
  });

  it('крон жив: захват в последний тик — не сбой при любой серии', () => {
    const { earlier, startedAt } = deploysEvery8h(runAt, now);
    expect(
      leaseProblem(DAILY, { runAt: LAST + 1_000, now, startedAt, earlier }),
    ).toBeNull();
  });
});
