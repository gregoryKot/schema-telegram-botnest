// Покрываем: buildCriterionIntro/buildCriterionQuestions — шапка и вопросы
// шага 5 дословно; caseVerdict — все четыре комбинации ответов плюс
// null-случаи (правило «read-after-write»-подобной сверки для
// денормализованного решения: вердикт обязан однозначно определяться по двум
// булевым полям); buildVerdictReply — все три ключа непустые. Плюс инвариант
// шага: слово «часть» вводится только на экране recognition (фидбек
// владельца 2026-08: на шаге 5 термин звучал до своего объяснения) — ни
// в шапке, ни в вопросах, ни в репликах вердикта его быть не должно.
import { describe, it, expect } from 'vitest';
import {
  buildCriterionIntro,
  buildCriterionQuestions,
  caseVerdict,
  buildVerdictReply,
} from './caseCriterion';
import type { CaseCriterionAnswers, Tr } from './caseTypes';

const tyTr: Tr = (ty) => ty;

/** Термин, который на шаге критерия ещё не введён. */
const PART_TERM = /част/i;

describe('buildCriterionIntro', () => {
  it('шапка дословно и без термина «часть»', () => {
    const intro = buildCriterionIntro(tyTr);
    expect(intro.title).toBe('Последний шаг — два вопроса');
    expect(intro.sub).toBe(
      'Они помогают отличить обычную досаду от реакции, которая включается сама.',
    );
    expect(PART_TERM.test(intro.title)).toBe(false);
    expect(PART_TERM.test(intro.sub)).toBe(false);
  });
});

describe('buildCriterionQuestions', () => {
  it('два вопроса с ожидаемыми ключами, дословно', () => {
    const questions = buildCriterionQuestions(tyTr);
    expect(questions.map((q) => q.key)).toEqual([
      'biggerThanCause',
      'talkedDown',
    ]);
    expect(questions.map((q) => q.text)).toEqual([
      'Реакция была крупнее повода?',
      'Сказать себе „ну и ладно“ — сработало?',
    ]);
  });

  it('вопросы без термина «часть» — он ещё не введён', () => {
    for (const q of buildCriterionQuestions(tyTr)) {
      expect(PART_TERM.test(q.text)).toBe(false);
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

  it('mode и ordinary дословно', () => {
    const replies = buildVerdictReply(tyTr);
    expect(replies.mode).toBe(
      'Сильнее повода и само не отпустило — это уже больше, чем досада. Дальше — что это было.',
    );
    expect(replies.ordinary).toBe(
      'Похоже на обычную досаду — так бывает. Запись останется, без далеко идущих выводов.',
    );
  });

  it('реплики без термина «часть» — он вводится только на recognition', () => {
    // Реплика видна на шаге критерия (до recognition), поэтому термин в ней
    // звучал бы до своего объяснения. «Пограничный случай» матчить не должен.
    const replies = buildVerdictReply(tyTr);
    for (const text of Object.values(replies)) {
      expect(PART_TERM.test(text)).toBe(false);
    }
  });
});
