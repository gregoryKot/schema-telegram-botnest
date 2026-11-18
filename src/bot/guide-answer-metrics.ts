// Карточка-ответ над выдачей поиска «Справочника» терапевта — строка блока «Справочник терапевта» в /stats.
import type { AnalyticsEventName } from '../analytics/analytics.constants';

export interface GuideAnswerMetrics {
  answers30: number; // раз за месяц над выдачей поиска показана карточка-ответ
  answerLinks30: number; // раз переходили по ссылке из неё
}

export const ANSWER_COUNTED: [keyof GuideAnswerMetrics, AnalyticsEventName][] =
  [
    ['answers30', 'cabinet_guide_answer_show'],
    ['answerLinks30', 'cabinet_guide_answer_link'],
  ];

/** Строки блока; карточку не показывали — пусто, переходов нет — без нуля. Чистая функция. */
export function formatGuideAnswerLines(m: GuideAnswerMetrics): string[] {
  if (m.answers30 === 0) return [];
  const links =
    m.answerLinks30 > 0
      ? `, по ссылкам из него перешли: ${m.answerLinks30}`
      : '';
  return [`Готовый ответ над поиском показан: ${m.answers30}${links}`];
}
