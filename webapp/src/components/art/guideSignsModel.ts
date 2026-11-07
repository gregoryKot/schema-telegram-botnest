// Какой знак у листа подсказок терапевту (docs/design/PAPER_2026-11.md, «Язык
// знаков»): режим — знак его группы, техника — свой знак (четыре техники берут
// мотив языка, который им точно подходит: стулья — Talk, письма — Sheets,
// осознанность — Breath, самосострадание — Heart), схема — знак домена
// (DomainArt). Чистые функции; рисунки — GuideSigns.tsx (режимы) и
// GuideSignsTechniques.tsx (техники). Тип техники — только тип: тексты
// подсказок грузятся отдельным чанком (guideLoader), и сюда они не тянутся.
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { getModeById, getSchemaById, SCHEMA_DOMAINS } from '../../schemaTherapyData';

/** Все знаки листов: по группе режимов, общий знак режимов, по технике. */
export const GUIDE_SIGNS = [
  'child_care', 'yield', 'shelter', 'shield', 'looming', 'together', 'cluster',
  'pattern_steps', 'rescript', 'horizon', 'talk', 'talk_past', 'flashcard', 'sheets',
  'breath', 'heart_frame', 'scales', 'spotlight', 'heart', 'grown',
] as const;

export type GuideSign = (typeof GUIDE_SIGNS)[number];

/** Группы режимов (id из MODE_GROUPS); сверка с данными — тестом модели. */
type ModeGroupId =
  | 'child' | 'coping_surrender' | 'coping_avoidance' | 'coping_overcompensation' | 'critic' | 'healthy';

/**
 * Знак группы режимов — круги, потому что режим — часть, которая у руля; знак говорит,
 * что с этой частью делают в терапии. Цвет главного круга — оттенок группы на карте
 * режимов (MODE_GROUP_HUE): детские — глина, копинги — сланец, критики — слива,
 * здоровые — мох.
 */
export const MODE_GROUP_SIGN: Record<ModeGroupId, GuideSign> = {
  child: 'child_care',
  coping_surrender: 'yield',
  coping_avoidance: 'shelter',
  coping_overcompensation: 'shield',
  critic: 'looming',
  healthy: 'together',
};

/** Знак техники: у каждой свой, общих нет. */
export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  imagery_rescripting: 'rescript',
  future_imagery: 'horizon',
  chairwork: 'talk',
  historical_role_play: 'talk_past',
  flashcards: 'flashcard',
  letters: 'sheets',
  pattern_breaking: 'pattern_steps',
  mindfulness: 'breath',
  empathic_confrontation: 'heart_frame',
  pros_cons: 'scales',
  mode_interview: 'spotlight',
  self_compassion: 'heart',
  healthy_adult_imagery: 'grown',
};

/** Знак режима по группе; режим без группы (свой режим терапевта) — общий знак режимов. */
export function modeSign(modeId: string): GuideSign {
  const groupId = getModeById(modeId)?.groupId as ModeGroupId | undefined;
  return (groupId && MODE_GROUP_SIGN[groupId]) || 'cluster';
}

/** Номер домена схемы 1–5 для DomainArt; неизвестная схема — 0, картинки нет. */
export function schemaDomain(schemaId: string): number {
  const domainId = getSchemaById(schemaId)?.domainId;
  return SCHEMA_DOMAINS.findIndex((d) => d.id === domainId) + 1;
}
