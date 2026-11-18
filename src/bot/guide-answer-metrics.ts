// Карточка-ответ над выдачей поиска «Справочника» терапевта — строка блока «Справочник терапевта» в /stats.
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsByKey } from './event-counts';

export interface GuideAnswerMetrics {
  answers30: number; // раз за месяц над выдачей поиска показана карточка-ответ
  answerLinks30: number; // раз переходили по ссылке из неё
}

const COUNTED: [keyof GuideAnswerMetrics, AnalyticsEventName][] = [
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

/** Блок «Справочник терапевта» с дописанной строкой о карточке-ответе за 30 дней. */
export async function withGuideAnswerLines(
  prisma: PrismaService,
  block: string,
): Promise<string> {
  const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
  const metrics = await countEventsByKey(prisma, COUNTED, createdAt);
  return [block, ...formatGuideAnswerLines(metrics)].join('\n');
}
