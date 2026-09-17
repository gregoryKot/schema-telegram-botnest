import { runProbes } from './runner';
import { Probe } from './types';

function probe(id: string, run: Probe['run'], critical = false): Probe {
  return { id, title: `Проба ${id}`, critical, run };
}

describe('runProbes', () => {
  it('агрегирует id/title/critical пробы с её результатом', async () => {
    const results = await runProbes([
      probe('a', async () => ({ ok: true, detail: 'всё хорошо' }), true),
      probe('b', async () => ({ ok: false, detail: 'сломано' })),
    ]);
    expect(results).toEqual([
      {
        id: 'a',
        title: 'Проба a',
        critical: true,
        ok: true,
        detail: 'всё хорошо',
        reportInHealth: true,
      },
      {
        id: 'b',
        title: 'Проба b',
        critical: false,
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
      critical: false,
      reportInHealth: false,
      run: async () => ({ ok: false, detail: 'скрыто от /health' }),
    };
    const results = await runProbes([hidden]);
    expect(results).toEqual([
      {
        id: 'hidden',
        title: 'Проба hidden',
        critical: false,
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
        critical: false,
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
