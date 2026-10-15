import { pollingStatus } from './polling-status';
import {
  POLLING_GRACE_MS,
  telegramPollingProbe,
} from './probe-telegram-polling';

const T0 = 1_000_000;
const env = { BOT_TOKEN: '1:TEST' };

beforeEach(() => pollingStatus.reset(T0));

const run = (at: number, e: NodeJS.ProcessEnv = env) =>
  telegramPollingProbe(e, () => at).run();

describe('telegramPollingProbe', () => {
  it('BOT_TOKEN не задан — выключено, не авария, как бы ни выглядело состояние', async () => {
    pollingStatus.set('failed', 'x', T0);
    expect(await run(T0 + 10 * POLLING_GRACE_MS, {})).toEqual({
      ok: true,
      detail: 'выключено',
    });
  });

  it('running — зелёная', async () => {
    pollingStatus.set('running', null, T0);
    const res = await run(T0 + 3_600_000);
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('принимает');
  });

  it('штатная остановка — не авария', async () => {
    pollingStatus.set('stopped', null, T0);
    expect((await run(T0 + 3_600_000)).ok).toBe(true);
  });

  it.each(['starting', 'failed'] as const)(
    '%s меньше 2 минут — ещё не авария (деплой, 409 от старого контейнера)',
    async (state) => {
      pollingStatus.set(state, state === 'failed' ? '409' : null, T0);
      expect((await run(T0 + POLLING_GRACE_MS - 1)).ok).toBe(true);
    },
  );

  it('failed дольше 2 минут — авария, в detail причина и сколько минут', async () => {
    pollingStatus.set('failed', '409: getUpdates ведёт другой экземпляр', T0);
    const res = await run(T0 + 5 * 60_000);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('5 мин');
    expect(res.detail).toContain('409');
  });

  it('starting дольше 2 минут (getUpdates так и не ответил) — авария', async () => {
    pollingStatus.set('starting', null, T0);
    const res = await run(T0 + POLLING_GRACE_MS);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('неизвестна');
  });

  it('лаунчер так и не запускался (idle) дольше 2 минут — авария', async () => {
    const res = await run(T0 + POLLING_GRACE_MS);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('так и не запускался');
  });

  it('mid-life: running → failed отсчитывает 2 минуты от срыва, а не от старта процесса', async () => {
    pollingStatus.set('running', null, T0);
    pollingStatus.set('failed', '409', T0 + 3_600_000);
    expect((await run(T0 + 3_600_000 + 30_000)).ok).toBe(true);
    expect((await run(T0 + 3_600_000 + POLLING_GRACE_MS)).ok).toBe(false);
  });
});
