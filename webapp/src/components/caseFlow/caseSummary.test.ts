import { describe, it, expect } from 'vitest';
import { collectedRows, rowSign } from './caseSummary';
import { buildQuickResult, INITIAL_QUICK_FIELDS, type CaseQuickFields } from '../../../../shared/src/case/quick/caseQuick';
import { CASE_BODY_CHIPS } from '../../../../shared/src/case/caseBodyChips';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';

const body = CASE_BODY_CHIPS.fear;
const full: CaseQuickFields = {
  ...INITIAL_QUICK_FIELDS,
  scene: 'Она ответила одним словом',
  gateId: 'fear',
  bodyChipIds: [body[0].id],
  impulseChipIds: [CASE_IMPULSES[0].id],
};
const labels = (step: Parameters<typeof collectedRows>[0], f = full) => collectedRows(step, f, body).map((r) => r.label);

describe('collectedRows — «Что собрали» растёт по шагам', () => {
  it('на первом шаге и на итоге листа нет (поле рядом, итог рисует свои строки)', () => {
    expect(labels('scene')).toEqual([]);
    expect(labels('result')).toEqual([]);
    expect(labels('modes')).toEqual([]);
    expect(labels('done')).toEqual([]);
  });

  it('шаг показывает только ответы до себя', () => {
    expect(labels('feel')).toEqual(['Момент']);
    expect(labels('steady')).toEqual(['Момент']);
    expect(labels('impulse')).toEqual(['Момент', 'Внутри']);
  });

  it('не отвеченное не выдумывается: пустая сцена — нет строки «Момент»', () => {
    expect(labels('feel', { ...full, scene: '  ' })).toEqual([]);
  });

  it('строки — те же, что у итога (тексты не расходятся)', () => {
    expect(collectedRows('impulse', full, body)).toEqual(buildQuickResult(full, body, CASE_IMPULSES).rows.slice(0, 2));
  });
});

describe('rowSign', () => {
  it('у каждой строки итога есть знак', () => {
    for (const r of buildQuickResult(full, body, CASE_IMPULSES).rows) expect(rowSign(r.label)).not.toBeNull();
  });
  it('неизвестная подпись и ключи прототипа — без знака', () => {
    expect(rowSign('Другое')).toBeNull();
    expect(rowSign('toString')).toBeNull();
  });
});
