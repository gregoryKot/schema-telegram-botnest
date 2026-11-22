// Раздел «Потребности» «Справочника»: пять базовых потребностей (shared/src/needs) и то, что за ними в
// справочнике уже есть, — домен схем этой потребности (domainNeedId), его «общее для домена» и схемы
// домена со строкой «какая потребность не закрыта». Текст для терапевта — лист потребности справочника
// (shared/src/schemaTherapy/guide/needs.ts); клиентское описание потребности сюда не идёт.
import type { NeedGuide } from '../../../../shared/src/schemaTherapy/guide/needTypes';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { buildNeedData, NEED_ORDER, type NeedId, type Tr } from '../../../../shared/src/needs/needData';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { needLook } from '../../../../shared/src/theme/entityLook';
import { domainNeedId } from '../../../../shared/src/schemaTherapy/schemaNeed';
import { TECHNIQUES_HUE } from '../../components/therapist/guide/guideLook';
import type { ReferenceGroup } from './guideReferenceModel';

export interface NeedGuideView {
  id: NeedId;
  name: string;
  subtitle: string;
  /** Текст для терапевта; тексты не доехали — на листе остаются домен и схемы. */
  guide?: NeedGuide;
  /** Домен схем, который складывается, когда потребность не закрыта. */
  domain: { id: string; name: string; note: string };
  /** Схемы домена, у которых есть лист в справочнике; `need` — строка листа схемы. */
  schemas: { id: string; name: string; need: string }[];
}

export type NeedTexts = Pick<Guide, 'buildSchemaDomainGuides'> & Partial<Pick<Guide, 'needGuides'>>;

/** Потребности в порядке NEED_ORDER; без домена со схемами в справочнике потребности в списке нет. */
export function buildNeedGuides(texts: NeedTexts, tr: Tr): NeedGuideView[] {
  const needs = buildNeedData(tr);
  const guides = texts.buildSchemaDomainGuides(tr);
  const theory = texts.needGuides?.() ?? [];
  return NEED_ORDER.flatMap((id) => {
    const domain = SCHEMA_DOMAINS.find((d) => domainNeedId(d.id) === id);
    const guide = domain && guides.find((g) => g.domainId === domain.id);
    if (!domain || !guide) return [];
    const schemas = domain.schemas.flatMap((s) => {
      const text = guide.schemas.find((g) => g.schemaId === s.id);
      return text ? [{ id: s.id, name: s.name, need: text.need }] : [];
    });
    if (schemas.length === 0) return [];
    const text = theory.find((t) => t.id === id);
    const { name, subtitle } = needs[id];
    return [{ id, name, subtitle: text?.subtitle ?? subtitle, guide: text, domain: { id: domain.id, name: domain.domain, note: guide.note }, schemas }];
  });
}

/** Один лист нейтральной бумаги, как у техник: знак у каждой строки свой. */
export function needGroups(views: NeedGuideView[]): ReferenceGroup[] {
  return [{
    key: 'needs',
    look: { hue: TECHNIQUES_HUE },
    items: views.map((n) => ({ kind: 'need' as const, id: n.id, name: n.name, sub: n.subtitle, sign: needLook(n.id).sign })),
  }];
}

/** Абзацы листа потребности для поиска — то, что на листе написано про саму потребность и её домен. */
export const needBody = (n: NeedGuideView): string[] =>
  [n.subtitle, n.guide?.essence, n.guide?.frustration, n.guide?.schemas, n.guide?.care, n.domain.name, n.domain.note]
    .filter((s): s is string => !!s?.trim());
