// Тест чистой логики карточки результата теста на схемы (шаринг).
// Профиль-часть карточки (группировка, подписи, высота) — ysqProfileCard.test.ts.
import { describe, it, expect } from 'vitest';
import {
  buildYsqShareText,
  pluralActiveSchemas,
  ysqCardHeadline,
} from '../../../../shared/src/share/cards/ysqCard';

describe('buildYsqShareText', () => {
  it('содержит счёт выраженных схем и ссылку на бота', () => {
    const text = buildYsqShareText(3, 't.me/TestBot');
    expect(text).toContain('3 выраженные схемы из 20');
    expect(text).toContain('t.me/TestBot');
  });

  it('ноль схем — явная формулировка', () => {
    expect(buildYsqShareText(0, 't.me/TestBot')).toContain(
      'выраженных схем не обнаружено',
    );
  });
});

describe('ysqCardHeadline', () => {
  it('счёт с правильным склонением и знаменателем', () => {
    expect(ysqCardHeadline(1)).toBe('1 выраженная схема из 20');
    expect(ysqCardHeadline(7)).toBe('7 выраженных схем из 20');
  });

  it('ноль — явная формулировка без числа', () => {
    expect(ysqCardHeadline(0)).toBe('Выраженных схем не обнаружено');
  });
});

describe('pluralActiveSchemas', () => {
  it.each([
    [1, 'выраженная схема'],
    [2, 'выраженные схемы'],
    [4, 'выраженные схемы'],
    [5, 'выраженных схем'],
    [20, 'выраженных схем'],
  ])('%i → %s', (n, expected) => {
    expect(pluralActiveSchemas(n)).toBe(expected);
  });
});
