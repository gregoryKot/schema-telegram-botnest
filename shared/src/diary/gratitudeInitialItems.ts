// Начальные пункты формы благодарности (инцидент 2026-10-18, docs/INCIDENTS.md).
//
// Сервер держит ОДНУ запись на день и каждым сохранением заменяет пункты
// целиком (`upsertGratitudeDiaryEntry`). Поэтому форма, открытая поверх уже
// сохранённого дня, обязана стартовать с этих пунктов — иначе новая запись
// молча стирает прежние. Выбор вынесен в чистую функцию: её зовут обе формы
// (сайт и мини-апп), правило №3.

/** Сколько полей показываем минимум: столько же, сколько у пустой формы. */
export const GRATITUDE_MIN_FIELDS = 3;

const blank = (s: string) => s.trim().length === 0;

/**
 * Пункты, с которых стартует форма.
 *  - есть сохранённая запись за день: её пункты, затем непустые пункты черновика,
 *    которых в записи нет (черновик пишется только для новой записи, его тоже
 *    нельзя потерять), затем пустые поля до минимума;
 *  - записи нет: черновик как есть, а без него — три пустых поля.
 */
export function pickGratitudeInitialItems(
  saved: readonly string[] | null | undefined,
  draft: readonly string[] | null | undefined,
): string[] {
  const savedItems = (saved ?? []).filter((s) => !blank(s));
  if (savedItems.length === 0) {
    return draft && draft.length > 0
      ? [...draft]
      : Array<string>(GRATITUDE_MIN_FIELDS).fill('');
  }
  const seen = new Set(savedItems.map((s) => s.trim()));
  const extras: string[] = [];
  for (const d of draft ?? []) {
    if (blank(d) || seen.has(d.trim())) continue;
    seen.add(d.trim());
    extras.push(d);
  }
  const merged = [...savedItems, ...extras];
  while (merged.length < GRATITUDE_MIN_FIELDS) merged.push('');
  return merged;
}
