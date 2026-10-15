// Чистые операции над связями режимов (ConceptModeLink): нормализация ответа
// сервера/черновика, поиск и замена по modeId. Связь режима, убранного с карты,
// не стирается — вернул режим, вернулись и связи, поэтому upsert её не трогает.
import type { ConceptModeLink } from '../../apiTypes';

export function emptyModeLink(modeId: string): ConceptModeLink {
  return {
    modeId,
    alias: '',
    schemaIds: [],
    needIds: [],
    origin: '',
    manifest: '',
    strategy: '',
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

/**
 * Приводит что угодно к валидному массиву связей: не массив → [], элемент без
 * строкового непустого modeId выбрасывается, недостающие поля → '' / [],
 * нестроковые элементы массивов выбрасываются, дубль modeId — первый
 * остаётся. Нужна и на входе (legacy-строки, битый кеш), и на выходе в POST.
 */
export function normalizeModeLinks(raw: unknown): ConceptModeLink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ConceptModeLink[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.modeId !== 'string' || r.modeId === '' || seen.has(r.modeId)) {
      continue;
    }
    seen.add(r.modeId);
    out.push({
      modeId: r.modeId,
      alias: str(r.alias),
      schemaIds: strings(r.schemaIds),
      needIds: strings(r.needIds),
      origin: str(r.origin),
      manifest: str(r.manifest),
      strategy: str(r.strategy),
    });
  }
  return out;
}

export function findModeLink(
  links: ConceptModeLink[],
  modeId: string,
): ConceptModeLink {
  return links.find((l) => l.modeId === modeId) ?? emptyModeLink(modeId);
}

/** Замена связи по modeId или добавление в конец; исходный массив не мутирует. */
export function upsertModeLink(
  links: ConceptModeLink[],
  link: ConceptModeLink,
): ConceptModeLink[] {
  return links.some((l) => l.modeId === link.modeId)
    ? links.map((l) => (l.modeId === link.modeId ? link : l))
    : [...links, link];
}

export function isModeLinkEmpty(link: ConceptModeLink): boolean {
  return (
    link.alias.trim() === '' &&
    link.schemaIds.length === 0 &&
    link.needIds.length === 0 &&
    link.origin.trim() === '' &&
    link.manifest.trim() === '' &&
    link.strategy.trim() === ''
  );
}
