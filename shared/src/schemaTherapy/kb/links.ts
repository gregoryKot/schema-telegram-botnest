// Связи справочника (.claude/rules/knowledge-base.md, раздел 2): рёбра хранятся один раз в
// полях разделов, обратная сторона вычисляется здесь и нигде не пишется руками.
import type { Tr } from '../guide/types';
import {
  buildModeGuides,
  buildSchemaGuides,
  buildConcernGuides,
} from '../guide/index';
import type { KbKind } from './check';

// id не зависят от формы обращения: одна форма на все вычисления.
const tr: Tr = (t) => t;

export type KbUsageKind = 'mode' | 'schema' | 'concern';

export interface KbLink {
  /** Вид раздела, где хранится связь. */
  from: KbUsageKind;
  /** Поле раздела. */
  field: string;
  /** Вид записи, на которую ведёт связь. */
  to: KbKind;
  /** Пары [id раздела, id цели]. */
  pairs: () => [string, string][];
}

const each = <T>(
  list: T[],
  src: (g: T) => string,
  dst: (g: T) => readonly string[] | undefined,
): [string, string][] =>
  list.flatMap((g) =>
    (dst(g) ?? []).map((d) => [src(g), d] as [string, string]),
  );

export const KB_LINKS: readonly KbLink[] = [
  {
    from: 'schema',
    field: 'modeIds',
    to: 'mode',
    pairs: () =>
      each(
        buildSchemaGuides(tr),
        (g) => g.schemaId,
        (g) => g.modeIds,
      ),
  },
  {
    from: 'schema',
    field: 'techniques',
    to: 'technique',
    pairs: () =>
      each(
        buildSchemaGuides(tr),
        (g) => g.schemaId,
        (g) => g.techniques,
      ),
  },
  {
    from: 'mode',
    field: 'techniques',
    to: 'technique',
    pairs: () =>
      each(
        buildModeGuides(tr),
        (g) => g.modeId,
        (g) => g.techniques,
      ),
  },
  {
    from: 'concern',
    field: 'modeIds',
    to: 'mode',
    pairs: () =>
      each(
        buildConcernGuides(tr),
        (g) => g.id,
        (g) => g.modeIds,
      ),
  },
  {
    from: 'concern',
    field: 'schemaIds',
    to: 'schema',
    pairs: () =>
      each(
        buildConcernGuides(tr),
        (g) => g.id,
        (g) => g.schemaIds,
      ),
  },
  {
    from: 'concern',
    field: 'techniques',
    to: 'technique',
    pairs: () =>
      each(
        buildConcernGuides(tr),
        (g) => g.id,
        (g) => g.techniques,
      ),
  },
];

/** Режим → схемы, где он характерен (обратная сторона SchemaGuide.modeIds), одним проходом. */
export function modeSchemaIndex(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const g of buildSchemaGuides(tr)) {
    for (const m of g.modeIds) out.set(m, [...(out.get(m) ?? []), g.schemaId]);
  }
  return out;
}

/** Схемы, для которых режим характерен (обратная сторона SchemaGuide.modeIds). */
export function schemasOfMode(modeId: string): string[] {
  return modeSchemaIndex().get(modeId) ?? [];
}

/** Техника → разделы режимов, схем и запросов, которые её зовут, одним проходом. */
export function techniqueUsageIndex(): Map<
  string,
  { kind: KbUsageKind; id: string }[]
> {
  const out = new Map<string, { kind: KbUsageKind; id: string }[]>();
  for (const l of KB_LINKS.filter((x) => x.to === 'technique')) {
    for (const [src, t] of l.pairs()) {
      out.set(t, [...(out.get(t) ?? []), { kind: l.from, id: src }]);
    }
  }
  return out;
}

/** Разделы режимов, схем и запросов, которые зовут технику. */
export function usagesOfTechnique(
  id: string,
): { kind: KbUsageKind; id: string }[] {
  return techniqueUsageIndex().get(id) ?? [];
}
