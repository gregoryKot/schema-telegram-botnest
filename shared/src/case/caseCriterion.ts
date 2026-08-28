/**
 * Критерий Jacob (несоразмерность реакции + невозможность самому себя
 * успокоить) как микроопрос шага 6 «Разбор случая» — два тапа вместо абзаца
 * теории. Человек применяет критерий к своему случаю, а не запоминает
 * определение: тот же принцип узнавания-вместо-чтения, что у рамок сцены и
 * чипов тела в этом же потоке.
 *
 * caseVerdict — чистая функция без побочных эффектов: сохранять запись или
 * заводить карточку режима решает вызывающий код по её результату. При
 * вердикте 'ordinary' запись всё равно сохраняется (случай зафиксирован в
 * дневнике), а карточка режима — нет; это заложено в самом типе CaseVerdict,
 * а не в отдельном булевом флаге, чтобы решение «заводить ли карту» нельзя
 * было принять в обход вердикта.
 */
import type { CaseCriterionAnswers, Tr } from './caseTypes';

export interface CaseCriterionQuestion {
  key: keyof CaseCriterionAnswers;
  text: string;
}

/**
 * Оба вопроса нейтральны, обращения в них нет — _tr держит сигнатуру
 * наравне с остальными build* модуля на случай будущей формулировки.
 */
export const buildCriterionQuestions = (_tr: Tr): CaseCriterionQuestion[] => [
  { key: 'biggerThanCause', text: 'Реакция была крупнее повода?' },
  { key: 'talkedDown', text: 'Уговорить себя „ну и ладно“ вышло?' },
];

export type CaseVerdict = 'mode' | 'ordinary' | 'borderline';

/**
 * mode — несоразмерно и не отпускает: похоже на часть, есть смысл завести
 * карту. ordinary — соразмерно и отпустило: обычная досада, карты не будет.
 * borderline и любой null-ответ — уверенности недостаточно ни в одну
 * сторону, решение откладывается до следующих похожих случаев.
 */
export function caseVerdict(answers: CaseCriterionAnswers): CaseVerdict {
  const { biggerThanCause, talkedDown } = answers;
  if (biggerThanCause === null || talkedDown === null) return 'borderline';
  if (biggerThanCause && !talkedDown) return 'mode';
  if (!biggerThanCause && talkedDown) return 'ordinary';
  return 'borderline';
}

/**
 * Реплика под каждый вердикт — нейтральна, без обращения; _tr зарезервирован
 * по той же причине, что и в buildCriterionQuestions.
 */
export const buildVerdictReply = (_tr: Tr): Record<CaseVerdict, string> => ({
  mode: 'Крупнее повода и не уговорить — значит, часть.',
  ordinary:
    'Похоже на обычную досаду. Записать всё равно стоит, но части тут может и не быть.',
  borderline:
    'Пограничный случай. Оставим как есть — через пару таких станет видно.',
});
