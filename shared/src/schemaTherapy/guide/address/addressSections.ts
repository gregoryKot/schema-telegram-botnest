import { META_FIELDS } from './addressTitles';

// Пункт «Между сессиями» — `{ kind, type, title, text|note }`: служебны только вид и тип.
const ITEM_META = new Set(['kind', 'type']);

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => !ITEM_META.has(k))
      .map(([, v]) => textOf(v))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Обход статьи по её полям: поле — раздел, объект из полей (копинг) — разделы `поле.ключ`.
 * Новое поле в types.ts получает адрес само; служебные — META_FIELDS.
 */
export function sectionsOf(
  article: Record<string, unknown>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(article)) {
    if (META_FIELDS.has(key)) continue;
    const parts: [string, unknown][] = isRecord(value)
      ? Object.entries(value).map(([sub, v]) => [`${key}.${sub}`, v])
      : [[key, value]];
    for (const [path, v] of parts) {
      const text = textOf(v);
      if (text) out.set(path, text);
    }
  }
  return out;
}
