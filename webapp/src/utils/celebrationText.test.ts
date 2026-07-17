// Тест текстовой логики Celebration, вынесенной в shared (правило №3
// CLAUDE.md, волна 2) — сравнение webapp/miniapp Celebration.tsx показало
// расхождение только в форматировании и одном намеренном стиле (fontWeight
// стрик-числа), логика формулировок была идентична в обеих копиях.
import { describe, it, expect } from 'vitest';
import {
  pluralDays,
  getMilestoneText,
} from '../../../shared/src/utils/celebrationText';

describe('pluralDays', () => {
  it('склоняет "день/дня/дней" по правилам русского языка', () => {
    expect(pluralDays(1)).toBe('день');
    expect(pluralDays(21)).toBe('день');
    expect(pluralDays(2)).toBe('дня');
    expect(pluralDays(4)).toBe('дня');
    expect(pluralDays(11)).toBe('дней');
    expect(pluralDays(5)).toBe('дней');
    expect(pluralDays(100)).toBe('дней');
  });
});

describe('getMilestoneText', () => {
  it('возвращает текст вехи для milestone-стрика', () => {
    expect(getMilestoneText(7)).toBe('Неделя подряд. Это настоящий сдвиг');
    expect(getMilestoneText(100)).toBe(
      '100 дней. Это уже не привычка, а образ жизни',
    );
  });

  it('возвращает особый текст для первого дня', () => {
    expect(getMilestoneText(1)).toBe('Первый день — самый важный');
  });

  it('для не-вехи возвращает счётчик дней подряд', () => {
    expect(getMilestoneText(5)).toBe('5 дней подряд');
  });
});
