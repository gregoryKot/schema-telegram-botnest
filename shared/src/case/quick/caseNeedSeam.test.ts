/**
 * Шов «сохранил разбор → карта показала повторяющуюся потребность»: три записи из
 * buildQuickSaveData с потребностью дают на карте шаг «потребности за неделю».
 */
import { describe, it, expect } from 'vitest';
import { CASE_BODY_CHIPS } from '../caseBodyChips';
import { CASE_IMPULSES } from '../caseImpulses';
import { caseNextStep } from '../caseNextStep';
import { buildNextStepInput, type CaseSource } from '../../map/mapInputs';
import { INITIAL_QUICK_FIELDS, buildQuickSaveData } from './caseQuick';

const TODAY = '2026-08-28';
const tr = (ty: string) => ty;

/** Запись разбора, как её сохранит сайт, в виде строки дневника для карты. */
function saved(needId: string, day: number): CaseSource {
  const data = buildQuickSaveData(
    {
      ...INITIAL_QUICK_FIELDS,
      scene: 'сцена',
      gateId: 'fear',
      modeId: 'vulnerable_child',
      needId,
    },
    CASE_BODY_CHIPS.fear,
    CASE_IMPULSES,
  );
  return {
    modeId: data.modeId,
    actualNeed: data.actualNeed,
    createdAt: new Date(Date.parse(TODAY) - day * 86400000).toISOString(),
    // Ответ Здорового Взрослого уже пробовали: ветка 5 выше не мешает.
    healthyResponse: day === 1 ? 'Я рядом' : undefined,
  };
}

const nextOf = (cases: CaseSource[]) =>
  caseNextStep(
    buildNextStepInput(
      cases,
      [{ modeId: 'vulnerable_child', triggers: 'тишина' }],
      false,
      TODAY,
    ),
    tr,
  ).id;

describe('потребность из разбора → «что дальше» на карте', () => {
  it('три записи с потребностью — «потребности за неделю»', () => {
    expect(
      nextOf([saved('play', 1), saved('limits', 2), saved('play', 3)]),
    ).toBe('needs_week');
  });

  it('две записи с потребностью и одна «не пойму» — повтора нет', () => {
    expect(
      nextOf([saved('play', 1), saved('limits', 2), saved('', 3)]),
    ).not.toBe('needs_week');
  });
});
