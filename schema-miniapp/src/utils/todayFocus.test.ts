// Тесты настраиваемого «Сегодня» (волна 2 нейродизайна).
import { describe, it, expect } from 'vitest';
import {
  parseFocusPractice,
  focusCardContent,
  isFocusDone,
} from './todayFocus';

describe('parseFocusPractice', () => {
  it('валидные значения проходят, мусор и null — tracker', () => {
    expect(parseFocusPractice('schema')).toBe('schema');
    expect(parseFocusPractice('mode')).toBe('mode');
    expect(parseFocusPractice('gratitude')).toBe('gratitude');
    expect(parseFocusPractice('tracker')).toBe('tracker');
    expect(parseFocusPractice(null)).toBe('tracker');
    expect(parseFocusPractice('мусор')).toBe('tracker');
  });
});

describe('focusCardContent', () => {
  it('трекер: динамический подзаголовок и кнопка по прогрессу', () => {
    const fresh = focusCardContent('tracker', 0, 5);
    expect(fresh.buttonLabel).toBe('Начать');
    const mid = focusCardContent('tracker', 2, 5);
    expect(mid.sub).toContain('Осталось 3 из 5');
    expect(mid.buttonLabel).toBe('Продолжить');
  });

  it('дневники: статичный контент с оценкой времени', () => {
    expect(focusCardContent('schema', 0, 5).chip).toContain('2 мин');
    expect(focusCardContent('gratitude', 0, 5).title).toBe('Три хорошие вещи');
  });
});

describe('isFocusDone', () => {
  const todayDone = { schema: true, mode: false, gratitude: false };
  it('tracker — по allRated', () => {
    expect(isFocusDone('tracker', { allRated: true, todayDone })).toBe(true);
    expect(isFocusDone('tracker', { allRated: false, todayDone })).toBe(false);
  });
  it('дневники — по сегодняшним записям', () => {
    expect(isFocusDone('schema', { allRated: false, todayDone })).toBe(true);
    expect(isFocusDone('mode', { allRated: true, todayDone })).toBe(false);
  });
});
