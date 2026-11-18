import type { Tr } from '../../../../shared/src/needs/types';
import { joinSentences, splitSentences } from '../../../../shared/src/schemaTherapy/guide/sentences';
import { normalizeSearchText } from '../../../../shared/src/utils/searchNormalize';
import { bodyKey } from './guideReferenceBody';
import { leafGroups } from './guideReferenceCoping';
import type { Reference, ReferenceItem, ReferenceTexts } from './guideReferenceModel';
import { parseReferenceQuery, textTokens } from './guideReferenceQuery';

/**
 * Карточка-ответ «Справочника» над выдачей поиска: запрос называет режим, схему или технику — наверху её название,
 * 2–3 предложения дословно из её листа и переходы на сам лист и связанные листы. Намерение «как работать» берёт
 * текст про работу, без него — суть. Сущность не распознана или у названий ничья — ответа нет, выдача как раньше.
 */
export type AnswerIntent = 'work' | 'essence';
type Entity = Extract<ReferenceItem, { kind: 'mode' | 'schema' | 'technique' }>;
type Kind = Entity['kind'];

export interface ReferenceAnswer {
  item: Entity;
  intent: AnswerIntent;
  /** Дословный текст листа, одним абзацем. */
  text: string;
  /** Связанные листы; пустой вид связи не показывается. */
  links: { kind: Kind; items: Entity[] }[];
}

/** Тексты и связи одного листа: про работу, суть и id связанных листов по видам. */
interface Source { work: string[]; essence: string[]; related: Partial<Record<Kind, readonly string[]>> }
export type AnswerSources = Map<string, Source>;

const MAX_SENTENCES = 3;
const MAX_LINKS = 6;
const MIN_NAME_WORD = 3;
const WORK = /^(работ|дела|сдела|помо[чг]|поступ|справ|вест|провод|провест|примен)/;

/** «Как работать / что делать / чем помочь» — по исходному запросу: в терминах поиска эти слова служебные. */
export function queryIntent(query: string): AnswerIntent {
  return normalizeSearchText(query).split(/[^a-zа-я0-9]+/).some((w) => WORK.test(w)) ? 'work' : 'essence';
}

const entities = (ref: Reference): Entity[] => (['modes', 'schemas', 'techniques'] as const)
  .flatMap((tab) => leafGroups(ref[tab]).flatMap((g) => g.items))
  .filter((i): i is Entity => i.kind !== 'note');

/**
 * Лист, который назвал запрос: больше всего слов запроса в названии, при равенстве — точных совпадений стема,
 * затем доля покрытого названия. Ничья («ребёнок» — у десяти режимов) или название — меньшая часть запроса — null.
 */
export function findEntity(ref: Reference, query: string): Entity | null {
  const terms = parseReferenceQuery(query);
  let best: { item: Entity; score: number } | null = null;
  let tie = false;
  for (const item of entities(ref)) {
    const name = textTokens(item.name).filter((t) => t.word.length >= MIN_NAME_WORD);
    const matched = terms.filter((q) => name.some((t) => t.stem.startsWith(q.stem))).length;
    if (matched === 0 || matched * 2 < terms.length) continue;
    const exact = terms.filter((q) => name.some((t) => t.stem === q.stem)).length;
    const covered = name.filter((t) => terms.some((q) => t.stem.startsWith(q.stem))).length / name.length;
    const score = matched * 100 + exact * 10 + covered;
    if (best && score === best.score) tie = true;
    else if (!best || score > best.score) { best = { item, score }; tie = false; }
  }
  return best && !tie ? best.item : null;
}

/** Тексты и связи листов в форме обращения `tr`; обратные связи (режим → схемы, техника → режимы и схемы) — из прямых. */
export function buildAnswerSources(texts: ReferenceTexts, tr: Tr): AnswerSources {
  const sources: AnswerSources = new Map();
  const users = new Map<string, Record<'mode' | 'schema', string[]>>();
  const use = (key: string, kind: 'mode' | 'schema', id: string) => {
    const entry = users.get(key) ?? { mode: [], schema: [] };
    entry[kind].push(id);
    users.set(key, entry);
  };
  texts.buildModeGuides(tr).forEach((g) => {
    g.techniques.forEach((t) => use(bodyKey({ kind: 'technique', id: t }), 'mode', g.modeId));
    sources.set(bodyKey({ kind: 'mode', id: g.modeId }), {
      work: [g.goal, g.relationship, g.experiential, g.cognitive, g.behavioral].filter((s): s is string => !!s),
      essence: [g.what],
      related: { technique: g.techniques },
    });
  });
  texts.buildSchemaDomainGuides(tr).flatMap((d) => d.schemas).forEach((s) => {
    s.techniques.forEach((t) => use(bodyKey({ kind: 'technique', id: t }), 'schema', s.schemaId));
    s.modeIds.forEach((m) => use(bodyKey({ kind: 'mode', id: m }), 'schema', s.schemaId));
    sources.set(bodyKey({ kind: 'schema', id: s.schemaId }), {
      work: s.interventions, essence: [s.essence], related: { technique: s.techniques, mode: s.modeIds },
    });
  });
  texts.buildTechniqueGuides(tr).forEach((t) => {
    sources.set(bodyKey({ kind: 'technique', id: t.id }), {
      work: t.steps, essence: [t.summary], related: {},
    });
  });
  users.forEach((by, key) => {
    const source = sources.get(key);
    if (source) source.related = { ...source.related, ...by };
  });
  return sources;
}

const firstSentences = (parts: string[]) => joinSentences(parts.flatMap(splitSentences).slice(0, MAX_SENTENCES));

/** Ответ на запрос; нет распознанного листа или у листа нет текста — null. Раздела про работу нет — берётся суть, и наоборот. */
export function referenceAnswer(ref: Reference, sources: AnswerSources, query: string): ReferenceAnswer | null {
  const item = findEntity(ref, query);
  const source = item && sources.get(bodyKey(item));
  if (!item || !source) return null;
  const asked = queryIntent(query);
  const intent = source[asked].length > 0 ? asked : asked === 'work' ? 'essence' : 'work';
  const text = firstSentences(source[intent]);
  if (!text) return null;
  const byKey = new Map(entities(ref).map((e) => [bodyKey(e), e]));
  const links: ReferenceAnswer['links'] = [];
  for (const kind of ['technique', 'mode', 'schema'] as const) {
    const found = (source.related[kind] ?? []).map((id) => byKey.get(`${kind}:${id}`));
    const items = found.filter((e): e is Entity => e !== undefined).slice(0, MAX_LINKS);
    if (items.length > 0) links.push({ kind, items });
  }
  return { item, intent, text, links };
}
