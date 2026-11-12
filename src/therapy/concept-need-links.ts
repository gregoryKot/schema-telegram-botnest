// Колесо потребностей клиента в концептуализации (ClientConceptualization.
// needLinks): по каждой из пяти потребностей — оценка 0–10 и заметка за три
// периода (детство, подростковый возраст, сейчас). Одно колесо на клиента.
// Контракт и зеркальный нормализатор сайта —
// shared/src/therapy/conceptGraph/needLinks.ts (бэкенд shared не импортирует;
// сверка формы — dto/concept-needs.dto.spec.ts).
//
// В заметках свободный текст, поэтому массив шифруется целиком, как
// modeLinks/schemaLinks. В общие списки полей concept-store.ts колесо НЕ
// входит намеренно: полное сохранение вкладки «Концептуализация»
// (concept-save.ts) и снимки истории версий (concept-history.ts) его не читают
// и не пишут — вкладка не затрёт колесо, которое правит холст. Единственный
// писатель — concept-needs.ts, единственное чтение — conceptView.
import { NEED_IDS } from '../bot/bot.service';
import { decryptJson, encryptJson } from '../utils/crypto';

export const NEED_PERIODS = ['child', 'teen', 'now'] as const;
export type NeedPeriod = (typeof NEED_PERIODS)[number];
export const NEED_RATING_MAX = 10;

export interface ConceptNeedLink {
  /** Потребность из NEED_IDS (= NEED_ORDER сайта). */
  needId: string;
  /** Насколько потребность удовлетворялась, 0–10; периода нет — не оценено (не ноль). */
  ratings: Partial<Record<NeedPeriod, number>>;
  /** Заметка: детский опыт, подростковый опыт, как удовлетворяется сейчас. */
  notes: Partial<Record<NeedPeriod, string>>;
}

type Raw = Record<string, unknown>;
const raw = (v: unknown): Raw =>
  typeof v === 'object' && v !== null ? (v as Raw) : {};

const isRating = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= NEED_RATING_MAX;
const isNote = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Значения по периодам, прошедшие проверку; чужие ключи и мусор отброшены. */
function byPeriod<T>(
  source: unknown,
  ok: (v: unknown) => v is T,
): Partial<Record<NeedPeriod, T>> {
  const from = raw(source);
  const out: Partial<Record<NeedPeriod, T>> = {};
  for (const p of NEED_PERIODS) {
    const v = from[p];
    if (ok(v)) out[p] = v;
  }
  return out;
}

/**
 * Сырое значение → колесо: только потребности из NEED_IDS в их порядке, без
 * дублей (остаётся первая запись), оценки — целые 0–10, заметки — непустые
 * строки. Потребность без единой оценки и заметки в список не попадает.
 * Один нормализатор на запись и на чтение: в БД и в ответе одна форма.
 */
export function normalizeNeedLinks(value: unknown): ConceptNeedLink[] {
  const first = new Map<unknown, Raw>();
  for (const item of Array.isArray(value) ? value.map(raw) : [])
    if (!first.has(item.needId)) first.set(item.needId, item);
  return NEED_IDS.flatMap((needId) => {
    const item = first.get(needId);
    const ratings = byPeriod(item?.ratings, isRating);
    const notes = byPeriod(item?.notes, isNote);
    const filled = Object.keys(ratings).length + Object.keys(notes).length;
    return filled > 0 ? [{ needId, ratings, notes }] : [];
  });
}

/**
 * Значение колонки → колесо для ответа. Шифротекст-строка расшифровывается;
 * строки без поля (до колонки), дефолтный `[]` и битое значение (не JSON, не
 * массив, чужой ключ) — пустое колесо, а не 500.
 */
export function readNeedLinks(stored: unknown): ConceptNeedLink[] {
  return normalizeNeedLinks(
    typeof stored === 'string' ? decryptJson<unknown>(stored) : stored,
  );
}

/** Колесо → значение колонки: шифротекст (без ключа в dev — JSON-строка). */
export const encryptNeedLinks = (links: ConceptNeedLink[]): string =>
  encryptJson(links) ?? JSON.stringify(links);
