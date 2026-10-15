import { clinicalLabelsStatus } from './clinical-labels-status';
import { clinicalLabelsProbe } from './probe-clinical-labels';

const env = { ENCRYPTION_KEY: 'aa'.repeat(32) };
const EMPTY = { encrypted: {}, failures: 0, unknownKey: {} };

beforeEach(() => clinicalLabelsStatus.reset());

const run = (e: NodeJS.ProcessEnv = env) => clinicalLabelsProbe(e).run();

describe('clinicalLabelsProbe', () => {
  it('не критична и не красит /health (строка под чужим ключом сама не уйдёт)', () => {
    const p = clinicalLabelsProbe(env);
    expect(p.id).toBe('clinicalLabels');
    expect(p.critical).toBe(false);
    expect(p.reportInHealth).toBe(false);
  });

  it('нет ENCRYPTION_KEY — выключено, как бы ни выглядело состояние', async () => {
    clinicalLabelsStatus.fail('x');
    expect(await run({})).toEqual({ ok: true, detail: 'выключено' });
  });

  it.each(['idle', 'running'] as const)(
    '%s — ещё идёт, не авария',
    async (s) => {
      if (s === 'running') clinicalLabelsStatus.start();
      expect(await run()).toEqual({
        ok: true,
        detail: 'проверка при старте ещё идёт',
      });
    },
  );

  it('прогон без остатка — зелёная', async () => {
    clinicalLabelsStatus.finish({ ...EMPTY, encrypted: { Note: 3 } });
    expect(await run()).toEqual({ ok: true, detail: 'все метки зашифрованы' });
  });

  it('миграция упала — красная с причиной', async () => {
    clinicalLabelsStatus.fail('connection refused');
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('connection refused');
  });

  it('строки под нечитаемым ключом — красная, детали по таблицам', async () => {
    clinicalLabelsStatus.finish({
      ...EMPTY,
      unknownKey: { Note: 2, ModeDiaryEntry: 1 },
    });
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('3 строк не читаются текущим ключом');
    expect(res.detail).toContain('Note: 2');
    expect(res.detail).toContain('ModeDiaryEntry: 1');
  });

  it('строки, которые не удалось записать, — красная', async () => {
    clinicalLabelsStatus.finish({ ...EMPTY, failures: 4 });
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('4 строк не удалось записать');
  });

  it('обе причины сразу — обе в detail', async () => {
    clinicalLabelsStatus.finish({
      ...EMPTY,
      failures: 1,
      unknownKey: { Note: 1 },
    });
    const res = await run();
    expect(res.detail).toContain('не читаются');
    expect(res.detail).toContain('не удалось записать');
  });
});
