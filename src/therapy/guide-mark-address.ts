// Адрес раздела «Справочника» на бэкенде (#1484). Бэкенд не импортирует shared/
// (rootDir — src), поэтому копия разбора, реестра переименований и таблицы
// смыслов из shared/src/schemaTherapy/guide/address/; сверку держит
// guide-mark-address.sync.spec.ts (правило №4). Текст разделов сервер не знает:
// «раздел изменился» (адрес не находит текста) решает сайт через resolveAddress.

/** Виды статей справочника — первая часть адреса. */
export const GUIDE_MARK_ARTICLE_KINDS = [
  'schema',
  'mode',
  'technique',
  'note',
  'concern',
  'phase',
  'need',
] as const;
export type GuideMarkArticleKind = (typeof GUIDE_MARK_ARTICLE_KINDS)[number];

/** meta.kind события guide_mark_added: вид статьи или копинг схемы (schemaLinks). */
export const GUIDE_MARK_KINDS = [
  ...GUIDE_MARK_ARTICLE_KINDS,
  'coping',
] as const;
export type GuideMarkKind = (typeof GUIDE_MARK_KINDS)[number];

export const GUIDE_ADDRESS_MAX = 200;
// Форма адреса в DTO: `<вид>:<id>/<путь>`; вид и смысл проверяет сервис.
export const ADDRESS_SHAPE = /^[a-z]+:[A-Za-z0-9_-]+\/[A-Za-z0-9_.]+$/;

const KIND_SET: ReadonlySet<string> = new Set(GUIDE_MARK_ARTICLE_KINDS);
const SHAPE =
  /^([a-z]+):([A-Za-z0-9_-]+)\/([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)$/;

export interface GuideMarkAddressParts {
  kind: GuideMarkArticleKind;
  articleId: string;
  path: string;
}

/** Разбор адреса; null — не адрес справочника. */
export function parseGuideAddress(raw: string): GuideMarkAddressParts | null {
  const m = SHAPE.exec(raw);
  if (!m || !KIND_SET.has(m[1])) return null;
  return { kind: m[1] as GuideMarkArticleKind, articleId: m[2], path: m[3] };
}

/** Копия GUIDE_ADDRESS_RENAMES: старый адрес → новый (`*` — любая статья вида). */
export const GUIDE_MARK_ADDRESS_RENAMES: Readonly<Record<string, string>> = {};

/** Адрес после реестра переименований (цепочка до конца, не больше 16 шагов). */
export function normalizeGuideAddress(
  address: string,
  renames: Readonly<Record<string, string>> = GUIDE_MARK_ADDRESS_RENAMES,
): string {
  let current = address;
  for (let hop = 0; hop < 16; hop++) {
    const parts = /^([a-z]+):([^/]+)\/(.+)$/.exec(current);
    const wildcard = parts && renames[`${parts[1]}:*/${parts[3]}`];
    const next =
      renames[current] ?? (wildcard ? wildcard.replace('*', parts[2]) : null);
    if (!next || next === current) return current;
    current = next;
  }
  return current;
}

/** Копия GUIDE_ADDRESS_TARGETS: что идёт не в GuideMark (копинг схемы — в schemaLinks). */
export const GUIDE_MARK_FOREIGN_TARGETS: readonly {
  kind: GuideMarkArticleKind;
  pathPrefix: string;
}[] = [{ kind: 'schema', pathPrefix: 'coping.' }];

/** Отметка по адресу ложится в таблицу GuideMark. */
export function isGuideMarkAddress(parts: GuideMarkAddressParts): boolean {
  return !GUIDE_MARK_FOREIGN_TARGETS.some(
    (r) => r.kind === parts.kind && parts.path.startsWith(r.pathPrefix),
  );
}
