import { runProbes } from './runner';
import { Probe } from './types';

function probe(id: string, run: Probe['run']): Probe {
  return { id, title: `Проба ${id}`, run };
}

describe('runProbes', () => {
  it('агрегирует id/title пробы с её результатом', async () => {
    const results = await runProbes([
      probe('a', async () => ({ ok: true, detail: 'всё хорошо' })),
      probe('b', async () => ({ ok: false, detail: 'сломано' })),
    ]);
    expect(results).toEqual([
      {
        id: 'a',
        title: 'Проба a',
        ok: true,
        detail: 'всё хорошо',
        reportInHealth: true,
      },
      {
        id: 'b',
        title: 'Проба b',
        ok: false,
        detail: 'сломано',
        reportInHealth: true,
      },
    ]);
  });

  it('reportInHealth: false у пробы — переносится в результат как есть', async () => {
    const hidden: Probe = {
      id: 'hidden',
      title: 'Проба hidden',
      reportInHealth: false,
      run: async () => ({ ok: false, detail: 'скрыто от /health' }),
    };
    const results = await runProbes([hidden]);
    expect(results).toEqual([
      {
        id: 'hidden',
        title: 'Проба hidden',
        ok: false,
        detail: 'скрыто от /health',
        reportInHealth: false,
      },
    ]);
  });

  it('одна упавшая (throw) проба не мешает увидеть остальные', async () => {
    const results = await runProbes([
      probe('ok', async () => ({ ok: true, detail: 'ok' })),
      probe('boom', async () => {
        throw new Error('unexpected');
      }),
    ]);
    expect(results.find((r) => r.id === 'ok')).toMatchObject({ ok: true });
    expect(results.find((r) => r.id === 'boom')).toMatchObject({
      ok: false,
      detail: 'unexpected',
    });
  });

  it('зависшая проба засчитывается упавшей по таймауту, не держит весь прогон', async () => {
    const hang = probe(
      'hang',
      () => new Promise(() => {}), // никогда не резолвится
    );
    const results = await runProbes([hang], 1000);
    expect(results).toEqual([
      {
        id: 'hang',
        title: 'Проба hang',
        ok: false,
        detail: 'не ответила за 1 с',
        reportInHealth: true,
      },
    ]);
  });

  it('пустой список проб — пустой результат, не падает', async () => {
    await expect(runProbes([])).resolves.toEqual([]);
  });
});

// Вспышки связи с зарубежными хостами (07.11.2026, см. Probe.retryOnce):
// одиночный провал живой пробы повторяется, авария — два провала подряд.
describe('runProbes — повтор упавшей пробы (retryOnce)', () => {
  const answers = (...rs: Array<Error | { ok: boolean; detail: string }>) => {
    const run = jest.fn();
    for (const r of rs)
      run.mockImplementationOnce(() =>
        r instanceof Error ? Promise.reject(r) : Promise.resolve(r),
      );
    return run;
  };
  const retried = (run: jest.Mock): Probe => ({
    id: 'live',
    title: 'Проба live',
    retryOnce: true,
    run,
  });

  it('упала → после паузы прошла: итог ok, два вызова, одна пауза', async () => {
    const run = answers(
      { ok: false, detail: 'fetch failed' },
      { ok: true, detail: 'отвечает' },
    );
    const pause = jest.fn().mockResolvedValue(undefined);
    const [r] = await runProbes([retried(run)], 1000, pause);
    expect(r).toMatchObject({ ok: true, detail: 'отвечает' });
    expect(run).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('упала дважды — авария с detail второй попытки', async () => {
    const run = answers(
      { ok: false, detail: 'первая: fetch failed' },
      { ok: false, detail: 'вторая: HTTP 502' },
    );
    const [r] = await runProbes([retried(run)], 1000, async () => {});
    expect(r).toMatchObject({ ok: false, detail: 'вторая: HTTP 502' });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('исключение на первой попытке — тоже повод для повтора', async () => {
    const run = answers(new Error('socket hang up'), {
      ok: true,
      detail: 'отвечает',
    });
    const [r] = await runProbes([retried(run)], 1000, async () => {});
    expect(r).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('таймаут на первой попытке — тоже повод для повтора', async () => {
    const run = jest
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ ok: true, detail: 'отвечает' });
    const [r] = await runProbes([retried(run)], 20, async () => {});
    expect(r).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('прошла сразу — один вызов, без паузы', async () => {
    const run = answers({ ok: true, detail: 'отвечает' });
    const pause = jest.fn().mockResolvedValue(undefined);
    const [r] = await runProbes([retried(run)], 1000, pause);
    expect(r).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('контроль: без флага упавшая проба не повторяется', async () => {
    const run = answers(
      { ok: false, detail: 'сломано' },
      { ok: true, detail: 'не должно дойти' },
    );
    const pause = jest.fn().mockResolvedValue(undefined);
    const [r] = await runProbes([probe('plain', run)], 1000, pause);
    expect(r).toMatchObject({ ok: false, detail: 'сломано' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });
});
