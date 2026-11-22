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

/** Схемы, для которых режим характерен (обратная сторона SchemaGuide.modeIds). */
export function schemasOfMode(modeId: string): string[] {
  return buildSchemaGuides(tr)
    .filter((g) => g.modeIds.includes(modeId))
    .map((g) => g.schemaId);
}

/** Разделы режимов, схем и запросов, которые зовут технику. */
export function usagesOfTechnique(
  id: string,
): { kind: KbUsageKind; id: string }[] {
  return KB_LINKS.filter((l) => l.to === 'technique').flatMap((l) =>
    l
      .pairs()
      .filter(([, t]) => t === id)
      .map(([src]) => ({ kind: l.from, id: src })),
  );
}
