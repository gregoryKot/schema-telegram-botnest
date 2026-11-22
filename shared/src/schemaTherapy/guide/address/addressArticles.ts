import { getModeById, getSchemaById } from '../../schemaTherapyData';
import {
  buildConcernGuides,
  buildModeGuides,
  buildSchemaDomainGuides,
  buildTechniqueGuides,
  practiceNotes,
} from '../index';
import type { Tr } from '../types';
import { GUIDE_ARTICLE_KINDS, type GuideArticleKind } from './addressFormat';
import { phaseArticles } from './addressArticlesPhase';
import { sectionsOf } from './addressSections';

/** Статья справочника, разложенная на разделы: путь раздела → его текст (непустой). */
export interface GuideAddressArticle {
  kind: GuideArticleKind;
  id: string;
  title: string;
  sections: Map<string, string>;
}

type ArticleSource = (
  tr: Tr,
  techniqueName: (id: string) => string,
) => GuideAddressArticle[];

const modeName = (id: string) => getModeById(id)?.name ?? '';

/** Вид статьи → её статьи. Тип требует источник у каждого вида из GUIDE_ARTICLE_KINDS. */
const SOURCES: Record<GuideArticleKind, ArticleSource> = {
  schema: (tr, techniqueName) =>
    buildSchemaDomainGuides(tr).flatMap((d) =>
      d.schemas.map((g) => ({
        kind: 'schema' as const,
        id: g.schemaId,
        title: getSchemaById(g.schemaId)?.name ?? g.schemaId,
        // Лист рисует фразу репарентинга и реплики одним разделом «Как это звучит».
        sections: sectionsOf({
          ...g,
          voice: [g.reparenting, ...(g.voice ?? [])],
          modeIds: g.modeIds.map(modeName),
          techniques: g.techniques.map(techniqueName),
          domainNote: d.note,
        }),
      })),
    ),
  mode: (tr, techniqueName) =>
    buildModeGuides(tr).map((g) => ({
      kind: 'mode' as const,
      id: g.modeId,
      title: modeName(g.modeId) || g.modeId,
      sections: sectionsOf({
        ...g,
        techniques: g.techniques.map(techniqueName),
      }),
    })),
  technique: (tr) =>
    buildTechniqueGuides(tr).map((t) => ({
      kind: 'technique' as const,
      id: t.id,
      title: t.name,
      sections: sectionsOf({ ...t }),
    })),
  note: (tr) =>
    practiceNotes(tr).map((n) => ({
      kind: 'note' as const,
      id: n.id,
      title: n.title,
      sections: sectionsOf({ ...n }),
    })),
  concern: (tr, techniqueName) =>
    buildConcernGuides(tr).map((c) => ({
      kind: 'concern' as const,
      id: c.id,
      title: c.name,
      sections: sectionsOf({
        ...c,
        modeIds: c.modeIds?.map(modeName),
        schemaIds: c.schemaIds?.map((id) => getSchemaById(id)?.name ?? ''),
        techniques: c.techniques?.map(techniqueName),
      }),
    })),
  phase: phaseArticles,
};

/** Все статьи справочника (или одного вида) с разделами, в форме обращения `tr`. */
export function guideAddressArticles(
  tr: Tr,
  kind?: GuideArticleKind,
): GuideAddressArticle[] {
  const names = new Map<string, string>(
    buildTechniqueGuides(tr).map((t) => [t.id, t.name]),
  );
  const techniqueName = (id: string) => names.get(id) ?? '';
  return (kind ? [kind] : GUIDE_ARTICLE_KINDS).flatMap((k) =>
    SOURCES[k](tr, techniqueName),
  );
}
