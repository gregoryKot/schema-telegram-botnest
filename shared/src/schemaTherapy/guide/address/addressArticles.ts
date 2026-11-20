import { getModeById, getSchemaById } from '../../schemaTherapyData';
import {
  buildModeGuides,
  buildSchemaDomainGuides,
  buildTechniqueGuides,
  practiceNotes,
} from '../index';
import type { Tr } from '../types';
import { GUIDE_ARTICLE_KINDS, type GuideArticleKind } from './addressFormat';
import { META_FIELDS } from './addressTitles';

/** Статья справочника, разложенная на разделы: путь раздела → его текст (непустой). */
export interface GuideAddressArticle {
  kind: GuideArticleKind;
  id: string;
  title: string;
  sections: Map<string, string>;
}

// Пункт «Между сессиями» — `{ kind, type, title, text|note }`: служебны только вид и тип.
const ITEM_META = new Set(['kind', 'type']);

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => !ITEM_META.has(k))
      .map(([, v]) => textOf(v))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Обход статьи по её полям: поле — раздел, объект из полей (копинг) — разделы `поле.ключ`.
 * Новое поле в types.ts получает адрес само; служебные — META_FIELDS.
 */
function sectionsOf(article: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(article)) {
    if (META_FIELDS.has(key)) continue;
    const parts: [string, unknown][] = isRecord(value)
      ? Object.entries(value).map(([sub, v]) => [`${key}.${sub}`, v])
      : [[key, value]];
    for (const [path, v] of parts) {
      const text = textOf(v);
      if (text) out.set(path, text);
    }
  }
  return out;
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
