import { clinicalLabelsStatus } from './clinical-labels-status';
import {
  clinicalLabelsProbe,
  CLINICAL_LABELS_STUCK_MS,
} from './probe-clinical-labels';

const env = { ENCRYPTION_KEY: 'aa'.repeat(32) };
const EMPTY = { encrypted: {}, failures: 0, unknownKey: {} };
const T0 = 1_800_000_000_000;
const MIN = 60_000;

beforeEach(() => clinicalLabelsStatus.reset(T0));

/** `at` — «сейчас» пробы; по умолчанию сразу после старта (в пределах порога). */
const run = (e: NodeJS.ProcessEnv = env, at: number = T0 + MIN) =>
  clinicalLabelsProbe(e, () => at).run();

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

  it('порог — 15 минут: меньше часового прогона самопроверки', () => {
    expect(CLINICAL_LABELS_STUCK_MS).toBe(15 * MIN);
  });

  it.each(['idle', 'running'] as const)(
    '%s в пределах порога — ещё идёт, не авария',
    async (s) => {
      if (s === 'running') clinicalLabelsStatus.start(T0);
      const at = T0 + CLINICAL_LABELS_STUCK_MS - 1;
      expect(await run(env, at)).toEqual({
        ok: true,
        detail: 'проверка при старте ещё идёт',
      });
    },
  );

  it('idle за порогом: main.ts не запустил миграцию — красная, сколько минут прошло', async () => {
    const res = await run(env, T0 + CLINICAL_LABELS_STUCK_MS);
    expect(res).toEqual({
      ok: false,
      detail:
        'дошифровка меток так и не запустилась: прошло 15 мин после старта',
    });
  });

  it('running за порогом: миграция зависла — красная; отсчёт от старта миграции, а не процесса', async () => {
    clinicalLabelsStatus.start(T0 + 10 * MIN);
    // с запуска процесса прошло 20 мин, но миграция идёт всего 10 — ещё зелёная
    expect((await run(env, T0 + 20 * MIN)).ok).toBe(true);
    const res = await run(env, T0 + 10 * MIN + CLINICAL_LABELS_STUCK_MS + MIN);
    expect(res).toEqual({
      ok: false,
      detail:
        'дошифровка меток идёт уже 16 мин и не закончилась, возможно завис запрос к базе',
    });
  });

  it('миграция завершилась — давность не важна: итог, а не таймер', async () => {
    clinicalLabelsStatus.finish(EMPTY, T0 + MIN);
    expect(await run(env, T0 + 24 * 60 * MIN)).toEqual({
      ok: true,
      detail: 'все метки зашифрованы',
    });
  });

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
    expect(res.detail).toBe(
      'строк под нечитаемым ключом: 3 (Note: 2, ModeDiaryEntry: 1) — старый ключ ' +
        'шифрования убран раньше, чем дошифровались строки',
    );
  });

  it('строки, которые не удалось записать, — красная', async () => {
    clinicalLabelsStatus.finish({ ...EMPTY, failures: 4 });
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toBe('не удалось записать строк: 4');
  });

  it('обе причины сразу — обе в detail', async () => {
    clinicalLabelsStatus.finish({
      ...EMPTY,
      failures: 1,
      unknownKey: { Note: 1 },
    });
    const res = await run();
    expect(res.detail).toContain('строк под нечитаемым ключом: 1 (Note: 1)');
    expect(res.detail).toContain('; не удалось записать строк: 1');
  });
});
