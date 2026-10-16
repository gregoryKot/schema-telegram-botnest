// Чистые операции над текстами схем (ConceptSchemaLink): нормализация ответа
// сервера/черновика, поиск и замена по schemaId. Связь схемы, убранной из
// концептуализации, не стирается — вернул схему, вернулись и тексты, поэтому
// upsert её не трогает (тот же приём, что в modeLinks.ts).
import type { ConceptSchemaLink } from '../../apiTypes';
import { laneOfMode } from './modeLanes';

export function emptySchemaLink(schemaId: string): ConceptSchemaLink {
  return { schemaId, belief: '', origin: '', needIds: [] };
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
 * Приводит что угодно к валидному массиву: не массив → [], элемент без
 * строкового непустого schemaId выбрасывается, недостающие поля → '' / [],
 * нестроковые элементы needIds выбрасываются, дубль schemaId — первый
 * остаётся. Нужна и на входе (legacy-строки, битый кеш), и на выходе в POST.
 */
export function normalizeSchemaLinks(raw: unknown): ConceptSchemaLink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ConceptSchemaLink[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.schemaId !== 'string' ||
      r.schemaId === '' ||
      seen.has(r.schemaId)
    ) {
      continue;
    }
    seen.add(r.schemaId);
    out.push({
      schemaId: r.schemaId,
      belief: str(r.belief),
      origin: str(r.origin),
      needIds: strings(r.needIds),
    });
  }
  return out;
}

export function findSchemaLink(
  links: ConceptSchemaLink[],
  schemaId: string,
): ConceptSchemaLink {
  return (
    links.find((l) => l.schemaId === schemaId) ?? emptySchemaLink(schemaId)
  );
}

/** Замена связи по schemaId или добавление в конец; исходный массив не мутирует. */
export function upsertSchemaLink(
  links: ConceptSchemaLink[],
  link: ConceptSchemaLink,
): ConceptSchemaLink[] {
  return links.some((l) => l.schemaId === link.schemaId)
    ? links.map((l) => (l.schemaId === link.schemaId ? link : l))
    : [...links, link];
}

export function isSchemaLinkEmpty(link: ConceptSchemaLink): boolean {
  return (
    link.belief.trim() === '' &&
    link.origin.trim() === '' &&
    link.needIds.length === 0
  );
}

/**
 * Схемы, которые рисует схема случая: отмеченные в концептуализации плюс
 * упомянутые в связях режимов с карты (связь не должна ссылаться на схему,
 * которой не видно). Здоровые режимы схемы не включают, их связи со схемами
 * не считаются. Тексты схемы без отметки в концептуализации схему на карту
 * не возвращают — «Убрать схему» должно убирать.
 */
export function conceptSchemaIds(
  schemaIds: string[],
  modeIds: string[],
  modeLinks: { modeId: string; schemaIds: string[] }[],
): Set<string> {
  const onMap = new Set(modeIds);
  const ids = new Set(schemaIds);
  for (const l of modeLinks) {
    if (!onMap.has(l.modeId) || laneOfMode(l.modeId) === 'healthy') continue;
    for (const id of l.schemaIds) ids.add(id);
  }
  return ids;
}
