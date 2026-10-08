import { describe, it, expect } from 'vitest';
import {
  CASE_HOOK_LEDE,
  DAY_INDEX_DEFINITION,
  buildSelfMapIntro,
  buildPracticesIntro,
} from './onboardingExplainers';

// Эти строки — единственный ответ на «откуда это и зачем» на своих экранах
// (аудит онбординга 2026-10). Тест пинит то, из-за чего они написаны: названный
// источник, обе формы обращения и отсутствие мужского рода в «ты»-ветке.
const ty = (a: string, _b: string) => a;
const vy = (_a: string, b: string) => b;

describe('объяснения первых экранов', () => {
  it('разбор случая называет, сколько шагов и что останется на выходе', () => {
    expect(CASE_HOOK_LEDE).toMatch(/Пять коротких шагов/);
    expect(CASE_HOOK_LEDE).toMatch(/останется в дневнике/);
  });

  it('индекс дня определён, а не просто назван', () => {
    expect(DAY_INDEX_DEFINITION).toMatch(/среднее из пяти оценок/);
  });

  it('карта себя и практики называют источник — схема-терапию', () => {
    expect(buildSelfMapIntro(ty)).toMatch(/схема-терапии/);
    expect(buildPracticesIntro(ty)).toMatch(/схема-терапии/);
  });

  it('обе формы обращения расходятся и согласованы', () => {
    expect(buildSelfMapIntro(ty)).toMatch(/из твоих разборов/);
    expect(buildSelfMapIntro(vy)).toMatch(/из ваших разборов/);
    expect(buildPracticesIntro(ty)).toMatch(
      /добавишь здесь.*будешь планировать/,
    );
    expect(buildPracticesIntro(vy)).toMatch(
      /добавите здесь.*будете планировать/,
    );
  });

  it('в «ты»-ветке нет мужского рода (правило «Род читателя»)', () => {
    for (const text of [buildSelfMapIntro(ty), buildPracticesIntro(ty)]) {
      expect(text).not.toMatch(/\bты (сделал|добавил|увидел|смог)\b/);
      expect(text).not.toMatch(/\b(должен|готов|уверен|рад)\b/);
    }
  });
});
