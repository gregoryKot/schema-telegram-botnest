// Когда класть снимок прежнего состояния (concept-history.ts). Правка в окне
// склейки снимка не кладёт — «до» уже лежит в hist[0]; «Восстановить»
// (restore) кладёт всегда: иначе правки окна пропали бы без следа.
import {
  CONCEPT_HISTORY_MAX,
  CONCEPT_SNAPSHOT_COALESCE_MS,
  nextConceptHistory,
} from './concept-history';

const MIN = 60_000;
const NOW = Date.parse('2026-11-15T10:12:00.000Z');

const row = (goals: string) => ({
  schemaIds: [],
  modeIds: [],
  earlyExperience: null,
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals,
  currentProblems: null,
  modeLinks: [],
  schemaLinks: [],
});
const snap = (goals: string, atMs: number) => ({
  savedAt: new Date(atMs).toISOString(),
  goals,
});
const goalsOf = (hist: unknown[]) =>
  hist.map((h) => (h as { goals: string }).goals);

describe('nextConceptHistory', () => {
  // Правка в 10:01 положила снимок «до правки»; сейчас 10:12 — окно склейки.
  const hist = [snap('до правки', NOW - 11 * MIN)];

  it('обычная правка в окне склейки снимка не кладёт — как раньше', () => {
    expect(nextConceptHistory(hist, row('правки 10:01–10:12'), NOW)).toBe(hist);
  });

  it('restore в окне склейки кладёт снимок нынешнего состояния', () => {
    const next = nextConceptHistory(hist, row('правки 10:01–10:12'), NOW, true);
    expect(goalsOf(next)).toEqual(['правки 10:01–10:12', 'до правки']);
    expect(next[0]).toMatchObject({ savedAt: new Date(NOW).toISOString() });
  });

  it('обычная правка после окна склейки кладёт снимок — как раньше', () => {
    const later = NOW + CONCEPT_SNAPSHOT_COALESCE_MS;
    expect(goalsOf(nextConceptHistory(hist, row('сейчас'), later))).toEqual([
      'сейчас',
      'до правки',
    ]);
  });

  it('restore держит потолок истории; строки нет — снимать нечего', () => {
    const full = Array.from({ length: CONCEPT_HISTORY_MAX }, (_, i) =>
      snap(`v${i}`, NOW - (i + 1) * MIN),
    );
    const next = nextConceptHistory(full, row('сейчас'), NOW, true);
    expect(next).toHaveLength(CONCEPT_HISTORY_MAX);
    expect(goalsOf(next)[0]).toBe('сейчас');
    expect(nextConceptHistory([], null, NOW, true)).toEqual([]);
  });
});
