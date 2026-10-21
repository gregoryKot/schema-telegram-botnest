// История версий концептуализации: когда класть снимок прежнего состояния.
//
// Сайт автосохраняет концептуализацию через 700 мс после каждой правки
// (webapp useClientDetail). Пока снимок клался на каждый save, десять минут
// печати вытесняли из 20 слотов все версии, включая месячную (аудит
// 2026-10, «Долг с механизмом»). Правило: снимок «до» берётся один раз в
// начале сессии правки — если самый свежий снимок моложе окна склейки,
// новый не кладётся, состояние «до» уже лежит в hist[0].
//
// savedAt хранится открытым ISO-текстом (шифруются только поля снимка),
// поэтому решение принимается по времени, без расшифровки.

export const CONCEPT_SNAPSHOT_COALESCE_MS = 30 * 60_000;
export const CONCEPT_HISTORY_MAX = 20;

// Поля строки ClientConceptualization, которые попадают в снимок. Значения
// уже зашифрованы — снимок переносит их как есть.
export interface ConceptSnapshotSource {
  schemaIds: unknown;
  modeIds: unknown;
  earlyExperience: string | null;
  unmetNeeds: string | null;
  triggers: string | null;
  copingStyles: string | null;
  goals: string | null;
  currentProblems: string | null;
  modeTransitions?: string | null;
  modeLinks: unknown;
  schemaLinks: unknown;
}

export function buildConceptSnapshot(
  existing: ConceptSnapshotSource,
  savedAt: string,
) {
  return {
    savedAt,
    schemaIds: existing.schemaIds,
    modeIds: existing.modeIds,
    earlyExperience: existing.earlyExperience,
    unmetNeeds: existing.unmetNeeds,
    triggers: existing.triggers,
    copingStyles: existing.copingStyles,
    goals: existing.goals,
    currentProblems: existing.currentProblems,
    modeTransitions: existing.modeTransitions ?? null,
    modeLinks: existing.modeLinks,
    schemaLinks: existing.schemaLinks,
  };
}

// Снимок моложе окна склейки? Неразбираемый или отсутствующий savedAt
// (наследные записи) и savedAt из будущего (часы инстанса разошлись) свежим
// не считаются: иначе такая запись заморозила бы историю навсегда.
function isFreshSnapshot(snap: unknown, nowMs: number): boolean {
  if (!snap || typeof snap !== 'object') return false;
  const savedAt = (snap as { savedAt?: unknown }).savedAt;
  if (typeof savedAt !== 'string') return false;
  const age = nowMs - Date.parse(savedAt);
  return age >= 0 && age < CONCEPT_SNAPSHOT_COALESCE_MS;
}

export function nextConceptHistory(
  hist: unknown[],
  existing: ConceptSnapshotSource | null,
  nowMs: number,
): unknown[] {
  if (!existing) return hist;
  if (isFreshSnapshot(hist[0], nowMs)) return hist;
  const snapshot = buildConceptSnapshot(
    existing,
    new Date(nowMs).toISOString(),
  );
  return [snapshot, ...hist].slice(0, CONCEPT_HISTORY_MAX);
}
