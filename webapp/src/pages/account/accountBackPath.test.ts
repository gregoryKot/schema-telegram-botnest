// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { THERAPIST_MODE_KEY } from '../../../../shared/src/utils/storageKeys';
import { accountBackPath, accountBackPathFromStorage } from './accountBackPath';

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

// Флаг ставим константой реестра: если страница начнёт читать другое имя ключа,
// «1» перестанет вести в кабинет и тест покраснеет.
describe('accountBackPathFromStorage', () => {
  afterEach(() => localStorage.removeItem(THERAPIST_MODE_KEY));

  it('читает флаг режима по общему ключу при каждом вызове: «1» — кабинет, «0» — «Сегодня»', () => {
    localStorage.setItem(THERAPIST_MODE_KEY, '1');
    expect(accountBackPathFromStorage()).toBe('/cabinet');
    localStorage.setItem(THERAPIST_MODE_KEY, '0');
    expect(accountBackPathFromStorage()).toBe('/today');
  });

  it('флага нет (ключ не задан) — «Сегодня»', () => {
    expect(accountBackPathFromStorage()).toBe('/today');
  });
});
