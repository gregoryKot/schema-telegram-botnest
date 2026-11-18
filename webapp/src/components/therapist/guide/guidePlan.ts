import type { BetweenSessionsItem, TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { splitSentences } from '../../../../../shared/src/schemaTherapy/guide/sentences';
import type { GuideFrom } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { PLAN_RUBRIC_LABEL, type PlanRubric, type PlanSource } from '../../../../../shared/src/therapy/plan/planItem';

/** Что кнопка «В план» несёт в лист: рубрика плана, поле статьи и текст по частям. */
export interface PlanSeed {
  rubric: PlanRubric;
  /** Поле статьи справочника — уходит в `source.field` пункта. */
  field: string;
  /** Подпись рубрики — заголовок листа и имя кнопки для ридера. */
  label: string;
  parts: string[];
}

/** Заготовка пункта: то же и статья, из которой он взят. */
export type PlanDraft = PlanSeed & { source: PlanSource };

type Channel = 'relationship' | 'cognitive' | 'experiential' | 'behavioral';

/** Направление «Как работать» листа режима — по предложениям. */
export const channelSeed = (key: Channel, text: string): PlanSeed => ({
  rubric: key, field: key, label: PLAN_RUBRIC_LABEL[key], parts: splitSentences(text),
});

/** «На сессии»: техники раздела, каждая — своей частью. */
export const sessionSeed = (techniques: readonly TechniqueGuide[]): PlanSeed => ({
  rubric: 'session', field: 'techniques', label: PLAN_RUBRIC_LABEL.session, parts: techniques.map((t) => t.name),
});

/** Пункт «Между сессиями»: название и пояснение или инструкция по предложениям. */
export const betweenSeed = (item: BetweenSessionsItem): PlanSeed => ({
  rubric: 'between', field: 'betweenSessions', label: item.title,
  parts: [item.title, ...splitSentences((item.kind === 'task' ? item.note : item.text) ?? '')],
});

export const planDraft = (seed: PlanSeed, from: GuideFrom): PlanDraft => ({
  ...seed, source: { kind: from.kind, id: from.id, field: seed.field },
});
