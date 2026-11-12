// Кнопка 404 (NotFoundPage): одна дорога дальше — по тому, вошёл ли человек (b26).
import { describe, it, expect } from 'vitest';
import { notFoundExit } from './notFoundExit';

describe('notFoundExit (404)', () => {
  it('гостю — на главную, вошедшему — в приложение', () => {
    expect(notFoundExit(false)).toEqual({ to: '/', label: 'На главную' });
    expect(notFoundExit(true)).toEqual({ to: '/today', label: 'В приложение' });
  });
});
