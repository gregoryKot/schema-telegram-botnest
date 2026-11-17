import type { Tr } from '../../../../shared/src/needs/types';
import { normalizeSearchText } from '../../../../shared/src/utils/searchNormalize';
import type { ReferenceItem, ReferenceTexts } from './guideReferenceModel';

/** Тексты листов для поиска: ключ строки списка → абзацы её листа в порядке полей. */
export type ReferenceBody = Map<string, string[]>;

export const bodyKey = (item: Pick<ReferenceItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;

// Служебные поля раздела: идентификаторы и ссылки на другие листы — не текст для чтения.
const SKIP = new Set(['id', 'modeId', 'schemaId', 'domainId', 'modeIds', 'techniques', 'kind', 'type', 'name', 'title']);

/** Все строки раздела, включая вложенные списки и пункты «Между сессиями» (их заголовок — текст, не имя листа). */
function strings(value: unknown, nested = false): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => strings(v, true));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => (SKIP.has(key) && !(nested && key === 'title') ? [] : strings(v, true)));
  }
  return [];
}

/** Тексты всех листов «Справочника» в форме обращения `tr`. Название листа сюда не входит — оно ищется отдельно. */
export function buildReferenceBody(texts: ReferenceTexts, tr: Tr): ReferenceBody {
  const body: ReferenceBody = new Map();
  texts.buildModeGuides(tr).forEach((g) => body.set(bodyKey({ kind: 'mode', id: g.modeId }), strings(g)));
  texts.buildSchemaDomainGuides(tr).forEach((d) => d.schemas.forEach((s) => body.set(bodyKey({ kind: 'schema', id: s.schemaId }), strings(s))));
  texts.buildTechniqueGuides(tr).forEach((t) => body.set(bodyKey({ kind: 'technique', id: t.id }), strings(t)));
  texts.practiceNotes(tr).forEach((n) => body.set(bodyKey({ kind: 'note', id: n.id }), strings(n)));
  return body;
}

const BEFORE = 30;
const AFTER = 90;

/** Кусок абзаца вокруг найденного слова: по границам слов, обрезанный край — с «…». */
export function snippet(paragraph: string, word: string): string {
  const at = normalizeSearchText(paragraph).indexOf(word);
  let from = Math.max(0, at - BEFORE);
  let to = Math.min(paragraph.length, at + word.length + AFTER);
  if (from > 0) from = paragraph.indexOf(' ', from) + 1 || from;
  if (to < paragraph.length) to = Math.max(paragraph.lastIndexOf(' ', to), at + word.length);
  return `${from > 0 ? '…' : ''}${paragraph.slice(from, to).trim()}${to < paragraph.length ? '…' : ''}`;
}
