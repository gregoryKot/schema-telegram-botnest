/**
 * Сборка подсказок терапевту (#995): режимы и библиотека техник. Тексты —
 * в guide/modes/* и guide/techniques/*, типы — guide/types.ts. Сверка
 * полноты — guide/guide.test.ts.
 */
import type {
  ModeGuide,
  ModeGuideBuilder,
  SchemaDomainGuide,
  SchemaDomainGuideBuilder,
  SchemaGuide,
  TechniqueGuide,
  TechniqueGuideBuilder,
  TechniqueId,
  Tr,
} from './types';
import { buildVulnerableChildGuides } from './modes/child';
import { buildAngryChildGuides } from './modes/childAngry';
import { buildCriticGuides } from './modes/critic';
import { buildSurrenderGuides } from './modes/surrender';
import { buildAvoidanceGuides } from './modes/avoidance';
import { buildOvercontrolGuides } from './modes/overcontrol';
import { buildAttackGuides } from './modes/attack';
import { buildHealthyGuides } from './modes/healthy';
import { buildImageryTechniques } from './techniques/imagery';
import { buildChairTechniques } from './techniques/chairs';
import { buildStanceTechniques } from './techniques/stance';
import { buildHomeworkTechniques } from './techniques/homework';
import { buildRejectionGuides } from './schemas/rejection';
import { buildAutonomyGuides } from './schemas/autonomy';
import { buildLimitsGuides } from './schemas/limits';
import { buildOtherDirectedGuides } from './schemas/otherDirected';
import { buildVigilanceGuides } from './schemas/vigilance';

const MODE_BUILDERS: ModeGuideBuilder[] = [
  buildVulnerableChildGuides,
  buildAngryChildGuides,
  buildCriticGuides,
  buildSurrenderGuides,
  buildAvoidanceGuides,
  buildOvercontrolGuides,
  buildAttackGuides,
  buildHealthyGuides,
];

const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = [
  buildImageryTechniques,
  buildChairTechniques,
  buildStanceTechniques,
  buildHomeworkTechniques,
];

const DOMAIN_BUILDERS: SchemaDomainGuideBuilder[] = [
  buildRejectionGuides,
  buildAutonomyGuides,
  buildLimitsGuides,
  buildOtherDirectedGuides,
  buildVigilanceGuides,
];

/** Все разделы режимов в порядке групп. */
export function buildModeGuides(tr: Tr): ModeGuide[] {
  return MODE_BUILDERS.flatMap((build) => build(tr));
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
  return DOMAIN_BUILDERS.map((build) => build(tr));
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

export function techniqueGuide(tr: Tr, id: TechniqueId): TechniqueGuide | null {
  return buildTechniqueGuides(tr).find((t) => t.id === id) ?? null;
}

export type {
  BetweenSessionsItem,
  GuideTaskType,
  ModeGuide,
  SchemaCoping,
  SchemaDomainGuide,
  SchemaGuide,
  TechniqueGuide,
  TechniqueId,
} from './types';
