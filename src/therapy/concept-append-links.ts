// Слияние связей «дописать с холста» (#963): линии схема → режим, а с
// колесом потребностей — «✓» режим → потребность (режим о ней заботится,
// ConceptModeLink.needIds) и «✗» схема → потребность (схема её блокирует,
// ConceptSchemaLink.needIds). Только добавление: id объединяются с тем, что
// уже стоит у связи, остальные поля (alias, убеждение, тексты, «Делали
// сегодня») не трогаются; связь без единого id не заводится. Оркестровка и
// запись — concept-append.ts.
import { NEED_IDS } from '../bot/bot.service';
import {
  CONCEPT_MODE_LINKS_MAX,
  CONCEPT_SCHEMA_LINKS_MAX,
} from './dto/conceptualization.dto';

// Потолки ConceptualizationDto: дописанное обязано проходить следующее полное
// сохранение полей (связей режимов ≤ 40, схем ≤ 20, схем у связи ≤ 20,
// потребностей у связи схемы ≤ 5) — сверка в concept-append.merge.spec.ts.
export const APPEND_MODE_LINKS_MAX = CONCEPT_MODE_LINKS_MAX;
export const APPEND_SCHEMA_LINKS_MAX = CONCEPT_SCHEMA_LINKS_MAX;
export const APPEND_LINK_SCHEMAS_MAX = 20;
export const APPEND_LINK_NEEDS_MAX = NEED_IDS.length;

export type ModeLink = Record<string, unknown> & { modeId: string };
export type SchemaLink = Record<string, unknown> & { schemaId: string };
export type ModeLinkAdd = {
  modeId: string;
  schemaIds: string[];
  needIds?: string[];
};
export type SchemaLinkAdd = { schemaId: string; needIds: string[] };

const KNOWN_NEEDS: ReadonlySet<string> = new Set(NEED_IDS);

export const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** base + новые из extra (без дублей), порядок: сначала существующие. */
export function union(
  base: string[],
  extra: string[],
  max = Infinity,
): string[] {
  const out = [...base];
  for (const id of extra) {
    if (out.length >= max) break;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Связи из расшифрованного поля: записи без строкового key отброшены. */
export function linksOf<K extends string>(v: unknown, key: K) {
  return (Array.isArray(v) ? (v as unknown[]) : []).filter(
    (l): l is Record<string, unknown> & Record<K, string> =>
      typeof l === 'object' &&
      l !== null &&
      typeof (l as Record<string, unknown>)[key] === 'string',
  );
}

/** Связь с дописанными в поле key id; та же ссылка — дописывать нечего. */
function addIds<L extends Record<string, unknown>>(
  link: L,
  key: string,
  ids: string[],
  max: number,
): L {
  const had = strings(link[key]);
  const next = union(had, ids, max);
  return next.length === had.length ? link : { ...link, [key]: next };
}

// Потребность не из NEED_IDS (= NEED_ORDER сайта) не пишется: DTO её не
// пустит, здесь — вторая линия для прямого вызова.
const addNeeds = <L extends Record<string, unknown>>(link: L, ids?: string[]) =>
  addIds(
    link,
    'needIds',
    (ids ?? []).filter((id) => KNOWN_NEEDS.has(id)),
    APPEND_LINK_NEEDS_MAX,
  );

/** Дописывает в найденную связь; нет её — заводит fresh, пока связей < max. */
function patchLink<L>(
  links: L[],
  i: number,
  fresh: L,
  apply: (l: L) => L,
  max: number,
): L[] {
  const base = i >= 0 ? links[i] : fresh;
  const next = apply(base);
  if (next === base) return links;
  if (i >= 0) return links.map((l, j) => (j === i ? next : l));
  return links.length < max ? [...links, next] : links;
}

// Новая связь режима — в форме normalizeModeLinks (shared/src/therapy/
// conceptGraph/modeLinks.ts, emptyModeLink): тексты пустые, их пишет терапевт.
const newModeLink = (modeId: string): ModeLink => ({
  modeId,
  alias: '',
  schemaIds: [],
  needIds: [],
  origin: '',
  manifest: '',
  strategy: '',
});

export function mergeModeLinks(cur: ModeLink[], add: ModeLinkAdd[] = []) {
  return add.reduce(
    (links, { modeId, schemaIds, needIds }) =>
      patchLink(
        links,
        links.findIndex((l) => l.modeId === modeId),
        newModeLink(modeId),
        (l) =>
          addNeeds(
            addIds(l, 'schemaIds', schemaIds, APPEND_LINK_SCHEMAS_MAX),
            needIds,
          ),
        APPEND_MODE_LINKS_MAX,
      ),
    cur,
  );
}

// Новая запись схемы — в форме ConceptSchemaLink: убеждение и опыт пустые.
export function mergeSchemaLinks(cur: SchemaLink[], add: SchemaLinkAdd[] = []) {
  return add.reduce(
    (links, { schemaId, needIds }) =>
      patchLink<SchemaLink>(
        links,
        links.findIndex((l) => l.schemaId === schemaId),
        { schemaId, belief: '', origin: '', needIds: [] },
        (l) => addNeeds(l, needIds),
        APPEND_SCHEMA_LINKS_MAX,
      ),
    cur,
  );
}
