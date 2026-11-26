// Как две записи с одним ключом складываются в одну при слиянии аккаунтов
// (R3, аудит 2026-11). Чистые функции над уже расшифрованными значениями:
// чтение, шифрование и запись — merge-combine.ts.
import { mergeGratitudeItems } from '../bot/gratitude-merge';
import { keepFilled, withoutEmptyFields } from '../bot/notes-partial';

/**
 * Заметка дня: текст текущего аккаунта, пустая строка, текст второго.
 * Пустой или совпадающий текст второго не дублируется.
 */
export function joinDayNotes(target: string, source: string): string {
  const t = target.trim();
  const s = source.trim();
  if (!s || s === t) return target;
  if (!t) return source;
  return `${t}\n\n${s}`;
}

/** Метки заметки (через запятую): сначала метки цели, затем новые из источника. */
export function joinTags(target: string, source: string): string {
  const all = [...target.split(','), ...source.split(',')].filter(Boolean);
  return [...new Set(all)].join(',');
}

/**
 * Пункты благодарности за день — пункты обоих без повторов (сравнение по
 * тексту без краёвых пробелов). Механика слияния сохранений с двух вкладок
 * (gratitude-merge.ts) с пустой базой: пункт встаёт рядом со своими соседями,
 * а без общих пунктов сначала идут пункты цели, следом — источника.
 */
export function joinGratitudeItems(
  target: readonly string[],
  source: readonly string[],
): string[] {
  return mergeGratitudeItems(target, [], source);
}

/**
 * Карточка схемы/режима: поля источника ложатся только в пустые поля цели,
 * заполненное поле цели остаётся как есть. Возвращает лишь то, что меняется.
 */
export function fillEmptyFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  fields: readonly string[],
): Record<string, string> {
  const fromSource = Object.fromEntries(fields.map((f) => [f, source[f]]));
  return keepFilled(withoutEmptyFields(fromSource), target, fields) as Record<
    string,
    string
  >;
}

/** [более новая, более старая]; при равенстве первой идёт цель. */
export function newerFirst<R>(
  target: R,
  source: R,
  at: (r: R) => Date,
): [R, R] {
  return at(source).getTime() > at(target).getTime()
    ? [source, target]
    : [target, source];
}
