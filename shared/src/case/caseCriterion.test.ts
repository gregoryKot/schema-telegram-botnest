// Покрываем: buildCriterionQuestions — два вопроса с правильными ключами;
// caseVerdict — все четыре комбинации ответов плюс null-случаи (правило
// «read-after-write»-подобной сверки для денормализованного решения:
// вердикт обязан однозначно определяться по двум булевым полям);
// buildVerdictReply — все три ключа непустые.
import { describe, it, expect } from 'vitest';
import {
  buildCriterionQuestions,
  caseVerdict,
  buildVerdictReply,
} from './caseCriterion';
import type { CaseCriterionAnswers, Tr } from './caseTypes';

const tyTr: Tr = (ty) => ty;

describe('buildCriterionQuestions', () => {
  it('два вопроса с ожидаемыми ключами и непустым текстом', () => {
    const questions = buildCriterionQuestions(tyTr);
    expect(questions.map((q) => q.key)).toEqual([
      'biggerThanCause',
      'talkedDown',
    ]);
    for (const q of questions) {
      expect(q.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('caseVerdict', () => {
  const answers = (
    biggerThanCause: boolean | null,
    talkedDown: boolean | null,
  ): CaseCriterionAnswers => ({ biggerThanCause, talkedDown });

  it('крупнее повода + не отпустило → mode', () => {
    expect(caseVerdict(answers(true, false))).toBe('mode');
  });

  it('не крупнее + отпустило → ordinary', () => {
    expect(caseVerdict(answers(false, true))).toBe('ordinary');
  });

  it('обе true → borderline', () => {
    expect(caseVerdict(answers(true, true))).toBe('borderline');
  });

  it('обе false → borderline', () => {
    expect(caseVerdict(answers(false, false))).toBe('borderline');
  });

  it('biggerThanCause = null → borderline', () => {
    expect(caseVerdict(answers(null, false))).toBe('borderline');
  });

  it('talkedDown = null → borderline', () => {
    expect(caseVerdict(answers(true, null))).toBe('borderline');
  });

  it('оба null → borderline', () => {
    expect(caseVerdict(answers(null, null))).toBe('borderline');
  });
});

describe('buildVerdictReply', () => {
  it('все три вердикта дают непустую реплику', () => {
    const replies = buildVerdictReply(tyTr);
    expect(replies.mode.trim().length).toBeGreaterThan(0);
    expect(replies.ordinary.trim().length).toBeGreaterThan(0);
    expect(replies.borderline.trim().length).toBeGreaterThan(0);
  });
});
