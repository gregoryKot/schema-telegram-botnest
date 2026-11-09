// Частичное сохранение концептуализации (POST /api/therapy/conceptualization/:clientId).
// До 2026-11 вкладка слала всё тело: 40 связей режимов и 20 связей схем,
// заполненные до предела, с полями — ~410 КБ при потолке тела 256 КБ
// (src/infra/body-limit.ts), то есть 413 на любой правке. Теперь уходит только
// изменённое против последнего ответа сервера (`base`): поля и списки целиком,
// связи — по одной (`upsert` по id, `remove` — id убранных); не больше
// CONCEPT_PATCH_LINKS_MAX связей каждого вида на запрос — худшее тело
// запроса меньше потолка (сверка — src/therapy/dto/concept-save.dto.spec.ts).
// Сервер применяет связи своей копией разбора (src/therapy/concept-save.ts:
// бэкенд не импортирует shared/), сверка — оба спека на одних образцах.
//
// Порядок: запрос несёт `baseVersion` — updatedAt строки, от которой считан
// патч. Строку успели изменить (холст в другом окне, вторая вкладка) — 409,
// вкладка перечитывает и накладывает свои правки на свежую версию
// (`rebaseConcept`), ничего не теряя.
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { normalizeModeLinks } from './modeLinks';
import { normalizeSchemaLinks } from './schemaLinks';
import type { ConceptSaveSource } from './conceptSaveBody';

/** Связей каждого вида в одном запросе; зеркало — ConceptSaveDto (src/therapy/dto/concept-save.dto.ts). */
export const CONCEPT_PATCH_LINKS_MAX = 6;

const TEXT_FIELDS = [
  'earlyExperience',
  'unmetNeeds',
  'triggers',
  'copingStyles',
  'goals',
  'currentProblems',
  'modeTransitions',
] as const;
const ID_LISTS = ['schemaIds', 'modeIds'] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type IdList = (typeof ID_LISTS)[number];

export interface LinksPatch<L> {
  upsert?: L[];
  remove?: string[];
}

export type ConceptPatch = Partial<Record<TextField, string>> &
  Partial<Record<IdList, string[]>> & {
    modeLinksPatch?: LinksPatch<ConceptModeLink>;
    schemaLinksPatch?: LinksPatch<ConceptSchemaLink>;
  };

/** Тело запроса: патч и версия строки, от которой он считан (null — строки не было). */
export type ConceptPatchRequest = ConceptPatch & { baseVersion: string | null };

const modeId = (l: { modeId: string }) => l.modeId;
const schemaId = (l: { schemaId: string }) => l.schemaId;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const text = (v: string | null | undefined) => v ?? '';

/** Связи `cur` после патча: upsert заменяет по id на месте или дописывает, remove убирает. */
export function applyLinksPatch<L>(
  cur: readonly L[],
  patch: LinksPatch<L> | undefined,
  idOf: (l: L) => string,
): L[] {
  if (!patch) return [...cur];
  const removed = new Set(patch.remove ?? []);
  const out = cur.filter((l) => !removed.has(idOf(l)));
  for (const link of patch.upsert ?? []) {
    const i = out.findIndex((l) => idOf(l) === idOf(link));
    if (i >= 0) out[i] = link;
    else out.push(link);
  }
  return out;
}

function linksPatch<L>(
  base: readonly L[],
  local: readonly L[],
  idOf: (l: L) => string,
): LinksPatch<L> | undefined {
  const upsert = local.filter((l) => {
    const b = base.find((x) => idOf(x) === idOf(l));
    return !b || !same(b, l);
  });
  const remove = base
    .map(idOf)
    .filter((id) => !local.some((l) => idOf(l) === id));
  if (!upsert.length && !remove.length) return undefined;
  return {
    ...(upsert.length ? { upsert } : {}),
    ...(remove.length ? { remove } : {}),
  };
}

/** Что изменилось в `local` против `base` (последний ответ сервера; null — строки ещё нет). */
export function conceptPatch(
  base: ConceptSaveSource | null,
  local: ConceptSaveSource,
): ConceptPatch {
  const b = base ?? {};
  const patch: ConceptPatch = {};
  for (const f of TEXT_FIELDS)
    if (text(local[f]) !== text(b[f])) patch[f] = text(local[f]);
  for (const f of ID_LISTS)
    if (!same(local[f] ?? [], b[f] ?? [])) patch[f] = local[f] ?? [];
  const ml = linksPatch(
    normalizeModeLinks(b.modeLinks),
    normalizeModeLinks(local.modeLinks),
    modeId,
  );
  const sl = linksPatch(
    normalizeSchemaLinks(b.schemaLinks),
    normalizeSchemaLinks(local.schemaLinks),
    schemaId,
  );
  if (ml) patch.modeLinksPatch = ml;
  if (sl) patch.schemaLinksPatch = sl;
  return patch;
}

/**
 * Патч → запросы: в каждом не больше CONCEPT_PATCH_LINKS_MAX связей каждого
 * вида; поля, списки и удаления — в первом. Пустой патч — ни одного запроса.
 */
export function chunkConceptPatch(patch: ConceptPatch): ConceptPatch[] {
  const { modeLinksPatch: ml, schemaLinksPatch: sl, ...rest } = patch;
  const modes = ml?.upsert ?? [];
  const schemas = sl?.upsert ?? [];
  const n = Math.max(
    1,
    Math.ceil(Math.max(modes.length, schemas.length) / CONCEPT_PATCH_LINKS_MAX),
  );
  const parts: ConceptPatch[] = [];
  for (let i = 0; i < n; i++) {
    const at = (xs: unknown[]) =>
      xs.slice(i * CONCEPT_PATCH_LINKS_MAX, (i + 1) * CONCEPT_PATCH_LINKS_MAX);
    const part: ConceptPatch = i === 0 ? { ...rest } : {};
    const mu = at(modes) as ConceptModeLink[];
    const su = at(schemas) as ConceptSchemaLink[];
    const mr = i === 0 ? ml?.remove : undefined;
    const sr = i === 0 ? sl?.remove : undefined;
    if (mu.length || mr) part.modeLinksPatch = { upsert: mu, remove: mr ?? [] };
    if (su.length || sr)
      part.schemaLinksPatch = { upsert: su, remove: sr ?? [] };
    if (Object.keys(part).length) parts.push(part);
  }
  return parts;
}

function rebaseLinks<L>(
  base: readonly L[],
  local: readonly L[],
  server: readonly L[],
  idOf: (l: L) => string,
): L[] {
  const p = linksPatch(base, local, idOf);
  return applyLinksPatch(server, p, idOf);
}

/**
 * Свежая версия сервера + правки вкладки поверх: поле, список или связь,
 * изменённые во вкладке против `base`, остаются её; остальное берётся с
 * сервера (там могло появиться дописанное холстом в другом окне).
 */
export function rebaseConcept<T extends ConceptSaveSource>(
  base: ConceptSaveSource | null,
  local: T,
  server: ConceptSaveSource | null,
): T {
  const s = server ?? {};
  const patch = conceptPatch(base, local);
  const out: T = { ...local };
  const o: ConceptSaveSource = out;
  for (const f of TEXT_FIELDS) o[f] = patch[f] ?? s[f] ?? '';
  for (const f of ID_LISTS) o[f] = patch[f] ?? s[f] ?? [];
  const b = base ?? {};
  o.modeLinks = rebaseLinks(
    normalizeModeLinks(b.modeLinks),
    normalizeModeLinks(local.modeLinks),
    normalizeModeLinks(s.modeLinks),
    modeId,
  );
  o.schemaLinks = rebaseLinks(
    normalizeSchemaLinks(b.schemaLinks),
    normalizeSchemaLinks(local.schemaLinks),
    normalizeSchemaLinks(s.schemaLinks),
    schemaId,
  );
  return out;
}
