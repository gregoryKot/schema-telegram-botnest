// Отметки «Делали сегодня» у техник подсказок терапевту (#995): массив `done`
// в связи режима или схемы (ConceptModeLink / ConceptSchemaLink). Рабочий
// журнал терапевта: хранится вместе со связями (шифруется целиком), клиенту не
// уходит — вид клиента собирает связь поле за полем без `done`
// (src/therapy/client-concept-view.ts). День — местный день терапевта
// (`todayStr()`): календарный день без зоны, показывается как есть (fmtDate).
import type { ConceptTechniqueMark } from '../../apiTypes';
import { CONCEPT_TECHNIQUE_MARKS_MAX } from '../../limits/textLimits';
import { fmtDate } from '../../utils/format';
import { isCalendarDate } from '../../utils/calendarDate';
import { pluralRu } from '../../utils/pluralRu';

/** Связь режима или схемы — то, что нужно отметкам. */
export interface MarkedLink {
  done?: ConceptTechniqueMark[];
}

export interface TechniqueMarkHistory {
  count: number;
  /** Последний день, `YYYY-MM-DD`. */
  lastDay: string;
}

const sameMark = (a: ConceptTechniqueMark, b: ConceptTechniqueMark) =>
  a.techniqueId === b.techniqueId && a.day === b.day;

/**
 * Что угодно → валидные отметки: элемент без строкового techniqueId или без
 * дня `YYYY-MM-DD` выбрасывается, повтор той же техники в тот же день — тоже.
 * Больше потолка DTO — остаются последние (сервер длиннее не примет).
 */
export function normalizeTechniqueMarks(raw: unknown): ConceptTechniqueMark[] {
  if (!Array.isArray(raw)) return [];
  const out: ConceptTechniqueMark[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { techniqueId, day } = item as Record<string, unknown>;
    if (typeof techniqueId !== 'string' || techniqueId === '') continue;
    if (typeof day !== 'string' || !isCalendarDate(day)) continue;
    const mark = { techniqueId, day };
    if (!out.some((m) => sameMark(m, mark))) out.push(mark);
  }
  return out.slice(-CONCEPT_TECHNIQUE_MARKS_MAX);
}

/** Отмечена ли техника в этот день. */
export function isMarkedOn(
  marks: ConceptTechniqueMark[] | undefined,
  techniqueId: string,
  day: string,
): boolean {
  return (marks ?? []).some((m) => sameMark(m, { techniqueId, day }));
}

/**
 * «Делали сегодня» и повторный тап в тот же день: отметки дня нет — ставится
 * (`added`), есть — снимается. Связь не мутирует.
 */
export function toggleLinkMark<L extends MarkedLink>(
  link: L,
  techniqueId: string,
  day: string,
): { link: L; added: boolean } {
  const marks = normalizeTechniqueMarks(link.done);
  const mark = { techniqueId, day };
  if (isMarkedOn(marks, techniqueId, day)) {
    return {
      link: { ...link, done: marks.filter((m) => !sameMark(m, mark)) },
      added: false,
    };
  }
  const done = [...marks, mark].slice(-CONCEPT_TECHNIQUE_MARKS_MAX);
  return { link: { ...link, done }, added: true };
}

/** Сколько раз делали технику и когда последний раз; ни разу — null. */
export function techniqueMarkHistory(
  marks: ConceptTechniqueMark[] | undefined,
  techniqueId: string,
): TechniqueMarkHistory | null {
  const days = normalizeTechniqueMarks(marks)
    .filter((m) => m.techniqueId === techniqueId)
    .map((m) => m.day);
  if (days.length === 0) return null;
  // `YYYY-MM-DD` сравнивается строкой: порядок строк совпадает с порядком дней.
  const lastDay = days.reduce((a, b) => (b > a ? b : a));
  return { count: days.length, lastDay };
}

/** «делали 5 ноя» / «делали 2 раза, последний 5 ноя». */
export function techniqueMarkLabel({
  count,
  lastDay,
}: TechniqueMarkHistory): string {
  if (count === 1) return `делали ${fmtDate(lastDay)}`;
  const times = pluralRu(count, 'раз', 'раза', 'раз');
  return `делали ${count} ${times}, последний ${fmtDate(lastDay)}`;
}
