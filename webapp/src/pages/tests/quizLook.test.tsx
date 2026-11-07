// @vitest-environment jsdom
// Знак мини-теста по id (quizLook.ts): тексты тестов живут на сервере
// (src/quiz/quiz-*.data.ts), знак — на сайте. Два места обязаны совпадать (правило
// №4): у каждого теста с сервера есть знак, иначе строка списка тихо съезжает на
// эмодзи. Плюс сама развилка: знакомый id — знак, незнакомый — эмодзи из контента.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { quizLook, QUIZ_SIGN_IDS } from './quizLook';
import { QuizSign } from './QuizSign';

afterEach(() => cleanup());

const QUIZ_DIR = join(__dirname, '../../../../src/quiz');
/** id теста — первое `id:` в файле данных (дальше идут id результатов). */
const serverQuizIds = () => readdirSync(QUIZ_DIR)
  .filter((f) => /^quiz-[\w-]+\.data\.ts$/.test(f))
  .map((f) => readFileSync(join(QUIZ_DIR, f), 'utf8').match(/\bid:\s*'([\w-]+)'/)?.[1])
  .filter((id): id is string => Boolean(id));

describe('quizLook: знак мини-теста', () => {
  it('у каждого теста с сервера есть знак, лишних знаков нет', () => {
    const ids = serverQuizIds();
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect([...ids].sort()).toEqual([...QUIZ_SIGN_IDS].sort());
  });

  it('незнакомый тест — без знака (эмодзи из контента), не чужая картинка', () => {
    expect(quizLook('critic', 0).Art).toBeTypeOf('function');
    expect(quizLook('new-quiz', 0).Art).toBeNull();
  });

  it('бумага строк идёт по кругу, соседи разного цвета, индекс вне списка не ломает', () => {
    const hues = [0, 1, 2, 3, 4].map((i) => quizLook('critic', i).hue);
    expect(new Set(hues).size).toBe(5);
    expect(quizLook('critic', 5).hue).toBe(hues[0]);
    expect(quizLook('critic', -1).hue).toBe(hues[4]);
  });

  it('QuizSign: знак рисуется картинкой, без знака — эмодзи; всё скрыто от чтения с экрана', () => {
    const { container, rerender } = render(<QuizSign quiz={{ id: 'battery', emoji: '🔋' }} index={2} />);
    const tile = container.querySelector('.pl2-quiz-sign') as HTMLElement;
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.textContent).toBe('');
    expect(tile.style.getPropertyValue('--h')).toBe(String(quizLook('battery', 2).hue));
    rerender(<QuizSign quiz={{ id: 'unknown', emoji: '🫶' }} index={0} />);
    expect(container.querySelector('.pl2-quiz-sign svg')).toBeNull();
    expect(container.textContent).toBe('🫶');
  });
});
