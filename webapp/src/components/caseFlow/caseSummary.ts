// «Что собрали» разбора (редизайн 2026-11, docs/design/APP_2026-11.md, b09): лист с ответами,
// который растёт по шагам. На компьютере он стоит под листом «Что случилось» в левой колонке
// разворота (CaseSummaryAside), на итоге — в основной колонке. Строки — те же, что у итога
// (buildQuickResult), чтобы лист и итог не расходились: шаг показывает только ответы ДО себя —
// поле текущего шага рядом, второй раз его не повторяем. Пустых строк нет: не ответил — строки нет.
import {
  buildQuickResult,
  type CaseQuickFields,
  type CaseQuickStep,
  type QuickResultRow,
} from '../../../../shared/src/case/quick/caseQuick';
import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';
import type { SignKey } from '../../../../shared/src/theme/entityLook';

/** Какие ответы уже собраны к шагу: момент — с шага «Что внутри?», внутри — с «Что хотелось».
 *  Итог рисует свои строки сам; на «Других режимах» листа нет — там те же чувства чипами, и
 *  «Страшно, тревожно» стояло бы на экране дважды. */
const KEEP: Partial<Record<CaseQuickStep, { feel: boolean }>> = {
  feel: { feel: false },
  steady: { feel: false },
  impulse: { feel: true },
};

export function collectedRows(step: CaseQuickStep, f: CaseQuickFields, bodyChips: CaseChip[]): QuickResultRow[] {
  const keep = KEEP[step];
  if (!keep) return [];
  const asked: CaseQuickFields = {
    ...f,
    gateId: keep.feel ? f.gateId : null,
    bodyChipIds: keep.feel ? f.bodyChipIds : [],
    bodyOwn: keep.feel ? f.bodyOwn : '',
    impulseChipIds: [],
    impulseOwn: '',
  };
  return buildQuickResult(asked, bodyChips, CASE_IMPULSES).rows;
}

/** Знак строки — только у момента: лента — мотив самого разбора. «Внутри» и «Хотелось» — без знака:
 *  полоски (`Strokes`) — это трекер и потребности, камешки (`Pebbles`) — дневник, и в итоге разбора
 *  знаки чужих сущностей путали смысл (ревью g2, PAPER_2026-11.md «один мотив на сущность»).
 *  Подпись без знака в таблице — строка без знака, не выдуманный; колонка знака остаётся — текст
 *  строк стоит по одному краю. */
export const ROW_SIGN: Record<string, SignKey> = {
  Момент: 'ribbon',
};

export const rowSign = (label: string): SignKey | null => (Object.hasOwn(ROW_SIGN, label) ? ROW_SIGN[label] : null);
