// @vitest-environment jsdom
// Развилка запуска установленного приложения: на компьютере — кабинет сайта,
// на телефоне — мини-апп. Матрица целиком под тестом: вживую её не
// прощёлкать (нужны установка, разные экраны и глубокие ссылки).
import { describe, it, expect } from 'vitest';
import { shouldOpenCabinet, CABINET_PATH } from './desktopLaunch';

const DESKTOP_APP = {
  standalone: true,
  hostId: 'web',
  width: 1440,
  pointerFine: true,
  search: '',
};

describe('shouldOpenCabinet', () => {
  it('установленное приложение на компьютере — кабинет', () => {
    expect(shouldOpenCabinet(DESKTOP_APP)).toBe(true);
  });

  it('вкладка браузера на компьютере — остаёмся в мини-аппе (открыл его сам)', () => {
    expect(shouldOpenCabinet({ ...DESKTOP_APP, standalone: false })).toBe(
      false,
    );
  });

  it('телефон: узкий экран или тач — мини-апп', () => {
    expect(shouldOpenCabinet({ ...DESKTOP_APP, width: 390 })).toBe(false);
    expect(shouldOpenCabinet({ ...DESKTOP_APP, pointerFine: false })).toBe(
      false,
    );
  });

  it('мессенджер — перенаправлять некуда', () => {
    expect(shouldOpenCabinet({ ...DESKTOP_APP, hostId: 'telegram' })).toBe(
      false,
    );
    expect(shouldOpenCabinet({ ...DESKTOP_APP, hostId: 'max' })).toBe(false);
  });

  it('глубокая ссылка (приглашение в пару) открывается в мини-аппе', () => {
    expect(
      shouldOpenCabinet({ ...DESKTOP_APP, search: '?startapp=invite_42' }),
    ).toBe(false);
    expect(
      shouldOpenCabinet({ ...DESKTOP_APP, search: '?start_param=invite_42' }),
    ).toBe(false);
  });

  it('прочие параметры запуска кабинету не мешают', () => {
    expect(
      shouldOpenCabinet({ ...DESKTOP_APP, search: '?section=today' }),
    ).toBe(true);
  });

  it('адрес кабинета помечен from=app — чтобы такие запуски были видны в отчёте', () => {
    expect(CABINET_PATH).toBe('/today?from=app');
  });
});
