// Колесо потребностей клиента в концептуализации (лист Farrell & Shaw «Как эти
// потребности удовлетворялись в детстве, в подростковом возрасте и сейчас»): по
// каждой из пяти потребностей — оценка 0–10 и текст за три периода. Хранится
// массивом в ClientConceptualization.needLinks (шифруется целиком, как modeLinks).
// Одно колесо на клиента: его правит колесо на холсте «Графических карт» и
// показывает вид «Схема» вкладки «Концептуализация». Шкала — та же, что у
// упражнения «Колесо детства» (ChildhoodRating); на экране она читается процентами.
import { NEED_ORDER } from '../../needs/types';

export type NeedPeriod = 'child' | 'teen' | 'now';
export const NEED_PERIODS: readonly NeedPeriod[] = ['child', 'teen', 'now'];
/** Подписи периодов листа — одни на колесе холста и на схеме случая. */
export const NEED_PERIOD_LABEL: Record<NeedPeriod, string> = {
  child: 'Детство',
  teen: '11–17 лет',
  now: 'Сейчас',
};

export interface ConceptNeedLink {
  /** NeedId из NEED_ORDER. */
  needId: string;
  /** Насколько потребность удовлетворялась, 0–10; периода нет — не оценено (не ноль). */
  ratings: Partial<Record<NeedPeriod, number>>;
  /** Текст листа: детский опыт, подростковый опыт, как удовлетворяется сейчас. */
  notes: Partial<Record<NeedPeriod, string>>;
}

const isRating = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;

const record = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

/**
 * Сырой JSON с сервера → колесо: только известные потребности в порядке
 * NEED_ORDER, без дублей, оценки — целые 0–10, тексты — непустые строки.
 * Потребность без единой оценки и текста в список не попадает.
 */
export function normalizeNeedLinks(raw: unknown): ConceptNeedLink[] {
  const items = Array.isArray(raw) ? raw.map(record) : [];
  const out: ConceptNeedLink[] = [];
  for (const needId of NEED_ORDER) {
    const item = items.find((r) => r.needId === needId);
    if (!item) continue;
    const [ratings, notes] = [record(item.ratings), record(item.notes)];
    const link: ConceptNeedLink = { needId, ratings: {}, notes: {} };
    for (const p of NEED_PERIODS) {
      if (isRating(ratings[p])) link.ratings[p] = ratings[p];
      const note = notes[p];
      if (typeof note === 'string' && note !== '') link.notes[p] = note;
    }
    if (Object.keys(link.ratings).length + Object.keys(link.notes).length > 0)
      out.push(link);
  }
  return out;
}

/** Оценки периода по потребностям, только выставленные. */
export function needRatings(
  links: readonly ConceptNeedLink[] | undefined,
  period: NeedPeriod,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of links ?? []) {
    const v = l.ratings[period];
    if (isRating(v)) out[l.needId] = v;
  }
  return out;
}

/** «70%» по оценке 0–10; не оценено — «—». */
export const needPct = (v: number | undefined): string =>
  v === undefined ? '—' : `${v * 10}%`;
