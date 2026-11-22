// Сборка подсказок терапевту (#995): тексты — guide/modes/*, guide/techniques/*, типы — guide/types.ts,
// сверка полноты — guide/guide.test.ts. Адреса разделов (#1484) — ./address: цикл импорта безопасен, функции зовутся при обходе.
import type {
  ModeGuide,
  PracticeNote,
  SchemaDomainGuide,
  SchemaGuide,
  TechniqueGuide,
  TechniqueId,
  Tr,
} from './types';
import { MODE_BUILDERS } from './modes/all';
import { withSessionSigns } from './modes/sessionSigns';
import { SCHEMA_DOMAIN_BUILDERS } from './schemas/domains';
import { TECHNIQUE_BUILDERS } from './techniques/all';
import { buildPracticeNotes } from './practice';

/** Все разделы режимов в порядке групп. */
export function buildModeGuides(tr: Tr): ModeGuide[] {
  return MODE_BUILDERS.flatMap((build) => build(tr)).map(withSessionSigns);
}

/** Вся библиотека техник. */
export function buildTechniqueGuides(tr: Tr): TechniqueGuide[] {
  return TECHNIQUE_BUILDERS.flatMap((build) => build(tr));
}

/** Раздел режима; null — у режима нет своего раздела (свой режим терапевта). */
export function modeGuide(tr: Tr, modeId: string): ModeGuide | null {
  return buildModeGuides(tr).find((g) => g.modeId === modeId) ?? null;
}

/** Домены схем в порядке справочника, со своими схемами. */
export function buildSchemaDomainGuides(tr: Tr): SchemaDomainGuide[] {
  return SCHEMA_DOMAIN_BUILDERS.map((build) => build(tr));
}

/** Все разделы схем. */
export function buildSchemaGuides(tr: Tr): SchemaGuide[] {
  return buildSchemaDomainGuides(tr).flatMap((d) => d.schemas);
}

/** Раздел схемы и «общее для домена»; null — у схемы нет раздела. */
export function schemaGuide(
  tr: Tr,
  schemaId: string,
): { guide: SchemaGuide; domainNote: string } | null {
  for (const d of buildSchemaDomainGuides(tr)) {
    const guide = d.schemas.find((g) => g.schemaId === schemaId);
    if (guide) return { guide, domainNote: d.note };
  }
  return null;
}

/** Раздел «Для терапевта» «Справочника». */
export function practiceNotes(tr: Tr): PracticeNote[] {
  return buildPracticeNotes(tr);
}

export function techniqueGuide(tr: Tr, id: TechniqueId): TechniqueGuide | null {
  return buildTechniqueGuides(tr).find((t) => t.id === id) ?? null;
}

export { needGuides } from './needs';
export type { NeedGuide } from './needTypes';
export * from './address';

export type {
  BetweenSessionsItem,
  GuideTaskType,
  ModeGuide,
  PracticeNote,
  SchemaCoping,
  SchemaDomainGuide,
  SchemaGuide,
  TechniqueGuide,
  TechniqueId,
  TechniqueGroupId,
  PracticeGroupId,
} from './types';
export * from './guideGroups';
export * from './concerns/all';
export * from './phases/all';
