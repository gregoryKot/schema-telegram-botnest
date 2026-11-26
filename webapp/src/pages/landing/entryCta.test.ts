import { describe, it, expect } from 'vitest';
import { entryCta } from './entryCta';

describe('entryCta', () => {
  it('гость: «Войти»/«Начать» ведут на /login, без «бесплатно»', () => {
    const e = entryCta(false);
    expect(e.href).toBe('/login');
    expect(e.nav).toBe('Войти');
    expect(e.main).not.toMatch(/бесплатно/i);
  });

  it('залогиненный: кнопка ведёт в приложение, а не на вход', () => {
    const e = entryCta(true);
    expect(e.href).toBe('/today');
    expect(e.nav).not.toBe('Войти');
  });
});
