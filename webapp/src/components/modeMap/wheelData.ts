import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import {
  NEED_PERIODS, normalizeNeedLinks, type ConceptNeedLink, type NeedPeriod,
} from '../../../../shared/src/therapy/conceptGraph/needLinks';

// Правки колеса потребностей (2026-11-12): оценки и тексты живут в концептуализации
// клиента (ClientConceptualization.needLinks) — одно колесо на клиента, его же
// показывает вид «Схема». Чистые функции: каждая возвращает новое колесо целиком,
// нормализованное (порядок NEED_ORDER, пустые потребности выпадают) — его и шлёт
// холст (`POST conceptualization/:clientId/needs`, replace).

type Links = readonly ConceptNeedLink[];

export const noteOf = (links: Links, period: NeedPeriod, needId: string): string =>
  links.find((l) => l.needId === needId)?.notes[period] ?? '';

function edit(links: Links, needId: string, change: (l: ConceptNeedLink) => void): ConceptNeedLink[] {
  const next = links.map((l) => ({ needId: l.needId, ratings: { ...l.ratings }, notes: { ...l.notes } }));
  let link = next.find((l) => l.needId === needId);
  if (!link) { link = { needId, ratings: {}, notes: {} }; next.push(link); }
  change(link);
  return normalizeNeedLinks(next);
}

/** Оценка потребности за период; undefined снимает оценку. */
export const setRating = (links: Links, period: NeedPeriod, needId: string, v: number | undefined): ConceptNeedLink[] =>
  edit(links, needId, (l) => { if (v === undefined) delete l.ratings[period]; else l.ratings[period] = v; });

/** Текст листа по потребности и периоду; пустой стирается. */
export const setNote = (links: Links, period: NeedPeriod, needId: string, text: string): ConceptNeedLink[] =>
  edit(links, needId, (l) => { if (text) l.notes[period] = text; else delete l.notes[period]; });

/** «Колесо детства» клиента → период «Детство»: то, что клиент оценил сам, перекрывает оценки терапевта. */
export function withChildhood(links: Links, childhood: Record<string, number>): ConceptNeedLink[] {
  let next: ConceptNeedLink[] = normalizeNeedLinks(links);
  for (const id of NEED_ORDER) {
    const v = childhood[id];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10) next = setRating(next, 'child', id, v);
  }
  return next;
}

/** Оценки и тексты, которые колесо держало в узле карты до переезда в концептуализацию (#1065). */
export interface LegacyWheel {
  ratings?: Partial<Record<NeedPeriod, Record<string, number>>>;
  notes?: Partial<Record<NeedPeriod, Record<string, string>>>;
}

export const hasLegacy = (w: LegacyWheel | undefined): boolean =>
  NEED_PERIODS.some((p) => Object.keys(w?.ratings?.[p] ?? {}).length + Object.keys(w?.notes?.[p] ?? {}).length > 0);

/**
 * Перенос из узла карты: концептуализация сильнее (в ней могло появиться новое),
 * значения узла заполняют только пустые места. Колесо, с которым совпало, — то же.
 */
export function mergeLegacy(links: Links, w: LegacyWheel): ConceptNeedLink[] {
  const legacy = normalizeNeedLinks(NEED_ORDER.map((needId) => ({
    needId,
    ratings: Object.fromEntries(NEED_PERIODS.map((p) => [p, w.ratings?.[p]?.[needId]])),
    notes: Object.fromEntries(NEED_PERIODS.map((p) => [p, w.notes?.[p]?.[needId]])),
  })));
  return normalizeNeedLinks(NEED_ORDER.map((needId) => {
    const [own, old] = [links.find((l) => l.needId === needId), legacy.find((l) => l.needId === needId)];
    return { needId, ratings: { ...old?.ratings, ...own?.ratings }, notes: { ...old?.notes, ...own?.notes } };
  }));
}
