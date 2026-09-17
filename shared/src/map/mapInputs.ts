/**
 * Сборка входов карты себя и движка «что дальше» из того, что уже отдаёт
 * бэкенд: записей дневника режимов и карточек режимов. Отдельного хранилища
 * у разбора нет — он сохраняется обычной записью дневника, поэтому и карта
 * строится из неё.
 *
 * Чистые функции: время и данные приходят снаружи, обе площадки собирают
 * входы одинаково (правило №3).
 *
 * Про признаки повторов честно. `repeatedTrigger` и `repeatedNeed` решают
 * ТОЛЬКО, какую кнопку показать следующей, и никогда не превращаются в
 * утверждение на экране: свободный текст повода и потребности мы не
 * сравниваем — сравнение строк дало бы ложные совпадения и ложные обещания.
 * Поэтому «повтор» здесь — это «одна и та же часть приходит третий раз» и
 * «человек трижды дописал, чего ему не хватало», а не выведенное сходство.
 */
import type { MapCase, MapInput, MapNote } from './mapVm';
import { laneForMode } from './mapVm';
import type { NextStepInput } from '../case/caseNextStep';

/** То, что нужно от записи дневника режимов. */
export interface CaseSource {
  modeId: string;
  createdAt: string;
  actualNeed?: string | null;
  healthyResponse?: string | null;
}

/** То, что нужно от карточки режима. */
export interface NoteSource {
  modeId: string;
  alias?: string;
  triggers?: string;
  feelings?: string;
  behavior?: string;
}

const filled = (v?: string | null): boolean => !!v && v.trim().length > 0;

/** Карточка считается собранной, когда в ней есть хоть одна примета. */
export function noteHasCard(note: NoteSource): boolean {
  return (
    filled(note.triggers) || filled(note.feelings) || filled(note.behavior)
  );
}

export function buildMapInput(
  cases: CaseSource[],
  notes: NoteSource[],
  ysqDone: boolean,
  warmWords: string[],
  today: string,
): MapInput {
  const mapCases: MapCase[] = cases.map((c) => ({
    modeId: c.modeId,
    at: c.createdAt,
  }));
  const mapNotes: MapNote[] = notes.map((n) => ({
    modeId: n.modeId,
    alias: n.alias,
    hasCard: noteHasCard(n),
  }));
  return { cases: mapCases, notes: mapNotes, warmWords, ysqDone, today };
}

/** Сколько раз одна и та же часть приходила, кто из них с карточкой. */
export function buildNextStepInput(
  cases: CaseSource[],
  notes: NoteSource[],
  ysqDone: boolean,
  today: string,
): NextStepInput {
  const noteByMode = new Map(notes.map((n) => [n.modeId, n]));
  const stats = new Map<string, { count: number; lastAt: string }>();
  for (const c of cases) {
    const prev = stats.get(c.modeId);
    stats.set(c.modeId, {
      count: (prev?.count ?? 0) + 1,
      lastAt: !prev || c.createdAt > prev.lastAt ? c.createdAt : prev.lastAt,
    });
  }

  const modeStats = [...stats.entries()].map(([modeId, s]) => {
    const note = noteByMode.get(modeId);
    return {
      modeId,
      alias: note?.alias,
      count: s.count,
      hasCard: note ? noteHasCard(note) : false,
      lastAt: s.lastAt,
    };
  });

  return {
    caseCount: cases.length,
    modeStats,
    hasChildMode: modeStats.some((m) => laneForMode(m.modeId) === 'backstage'),
    hasCopingMode: modeStats.some((m) => laneForMode(m.modeId) === 'stage'),
    healthyResponseCount: cases.filter((c) => filled(c.healthyResponse)).length,
    repeatedTrigger: modeStats.some((m) => m.count >= 3),
    repeatedNeed: cases.filter((c) => filled(c.actualNeed)).length >= 3,
    ysqDone,
    today,
  };
}
