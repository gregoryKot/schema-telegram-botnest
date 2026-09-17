// stripUrlSecrets — второй (бэкендный) слой обороны от утечки живых
// креденшелов (initData/JWT) через фрагмент/query URL в логи и DM админа
// (аудит 2026-07-20, H0). client-errors.controller.spec.ts уже гоняет его
// через сценарии полного контроллера — здесь отдельные граничные входы
// самой функции, включая то, чего HTTP-сценарий не покрывает.
import { stripUrlSecrets } from './telemetry-url.util';

describe('stripUrlSecrets', () => {
  it('undefined/пустая строка → undefined', () => {
    expect(stripUrlSecrets(undefined)).toBeUndefined();
    expect(stripUrlSecrets('')).toBeUndefined();
  });

  it('строка из одних пробелов → undefined (после trim пусто)', () => {
    expect(stripUrlSecrets('   ')).toBeUndefined();
  });

  it('обрезает и query (?...), и fragment (#...)', () => {
    expect(
      stripUrlSecrets('https://x.ru/path?token=secret#tgWebAppData=leak'),
    ).toBe('https://x.ru/path');
  });

  it('URL без query/fragment остаётся как есть (в пределах лимита длины)', () => {
    expect(stripUrlSecrets('https://x.ru/plain/path')).toBe(
      'https://x.ru/plain/path',
    );
  });

  it('только query, без fragment', () => {
    expect(stripUrlSecrets('https://x.ru/a?x=1&y=2')).toBe('https://x.ru/a');
  });

  it('только fragment, без query', () => {
    expect(stripUrlSecrets('https://x.ru/a#section')).toBe('https://x.ru/a');
  });

  it('обрезает до 200 символов после срезки query/fragment', () => {
    const longPath = 'https://x.ru/' + 'a'.repeat(300);
    const res = stripUrlSecrets(longPath)!;
    expect(res.length).toBe(200);
    expect(res).toBe(longPath.slice(0, 200));
  });

  it('после обрезки query/fragment пустой путь → undefined', () => {
    // '#'/'?' — первый символ, до него ничего нет.
    expect(stripUrlSecrets('#tgWebAppData=leak')).toBeUndefined();
    expect(stripUrlSecrets('?token=leak')).toBeUndefined();
  });
});
