import { describe, it, expect } from 'vitest';
import { accountBackPath } from './accountBackPath';

describe('accountBackPath', () => {
  it('флаг режима терапевта «1» — назад в кабинет (клиентское «Сегодня» вернуло бы туда редиректом)', () => {
    expect(accountBackPath('1')).toBe('/cabinet');
  });

  it('режим клиента — назад в «Сегодня»: «0», пустое значение и отсутствие флага', () => {
    expect(accountBackPath('0')).toBe('/today');
    expect(accountBackPath('')).toBe('/today');
    expect(accountBackPath(null)).toBe('/today');
  });
});
