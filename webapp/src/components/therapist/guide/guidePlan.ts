import type { BetweenSessionsItem, TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { splitSentences } from '../../../../../shared/src/schemaTherapy/guide/sentences';
import type { GuideFrom } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { PLAN_RUBRIC_LABEL, type GuideChannel, type PlanRubric } from '../../../../../shared/src/therapy/plan/planItem';
import { guessPlanRubric } from '../../../../../shared/src/therapy/plan/planRubricGuess';
import { articleAddress } from './marks/guideMarkModel';
import { liftCites } from './guideTextModel';

/** Что кнопка «В план» несёт в лист: рубрика плана, поле статьи и текст по частям. */
export interface PlanSeed {
  rubric: PlanRubric;
  /** Путь раздела статьи — по нему адрес, тот же, что у «Про клиента» (articleAddress). */
  field: string;
  label: string; // подпись рубрики — заголовок листа и имя кнопки для ридера
  parts: string[];
  /** Рубрика подобрана по тексту — лист «В план» даёт её сменить. */
  pickRubric?: boolean;
}

/** Заготовка пункта: то же и адрес раздела, из которого он взят. */
export type PlanDraft = PlanSeed & { sourceAddress: string };

/** Направление «Как работать» листа режима — по предложениям. */
export const channelSeed = (key: GuideChannel, text: string): PlanSeed => ({ rubric: key, field: key, label: PLAN_RUBRIC_LABEL[key], parts: splitSentences(text) });

/** «На сессии»: техники раздела, каждая — своей частью. */
export const sessionSeed = (techniques: readonly TechniqueGuide[]): PlanSeed => ({
  rubric: 'session', field: 'techniques', label: PLAN_RUBRIC_LABEL.session, parts: techniques.map((t) => t.name),
});

/** Рубрика «Между сессиями» целиком (плашка «Обычно в методе»): названия пунктов, каждое — своей частью. */
export const betweenRubricSeed = (items: readonly BetweenSessionsItem[]): PlanSeed => ({
  rubric: 'between', field: 'betweenSessions', label: PLAN_RUBRIC_LABEL.between, parts: items.map((i) => i.title),
});

/** Пункт «Между сессиями»: название и пояснение или инструкция по предложениям. */
export const betweenSeed = (item: BetweenSessionsItem): PlanSeed => ({
  rubric: 'between', field: 'betweenSessions', label: item.title,
  parts: [item.title, ...splitSentences((item.kind === 'task' ? item.note : item.text) ?? '')],
});

/** Пункт «Что делать» листа схемы: рубрика — канал метода по смыслу пункта, текст по предложениям. */
export const interventionSeed = (text: string): PlanSeed => ({
  rubric: guessPlanRubric(text), field: 'interventions', label: 'Что делать', parts: splitSentences(text), pickRubric: true,
});

/** Имя кнопки «В план» у пункта — его первая фраза без меток книг. */
export const pointLabel = (text: string) => liftCites(splitSentences(text)[0] ?? text).text;

export const planDraft = (seed: PlanSeed, from: GuideFrom): PlanDraft => ({ ...seed, sourceAddress: articleAddress(from.kind, from.id)(seed.field) });
