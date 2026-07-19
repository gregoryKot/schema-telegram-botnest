// Security-трипваер: CSRF на изменяющих состояние cookie-эндпоинтах
// (security-таск 2026-07-17). refresh/logout аутентифицируются httpOnly-
// кукой refresh_token — браузер шлёт её автоматически на любой cross-site
// запрос, поэтому без CSRF-проверки злоумышленный сайт мог бы разлогинить
// или провернуть ротацию токена жертвы. Инвариант: каждый хендлер, читающий
// REFRESH_COOKIE, ПЕРВЫМ делом зовёт requireCsrf; куки не sameSite:none.
import { readFileSync } from 'fs';
import { join } from 'path';

const CTRL = join(__dirname, '../auth/auth.controller.ts');
const src = readFileSync(CTRL, 'utf8');

// Разбиваем на блоки-хендлеры по декораторам маршрутов.
function handlerBlocks(text: string): { head: string; body: string }[] {
  const parts = text.split(/\n(?=\s*@(?:Post|Get|Patch|Delete|Put)\()/);
  return parts
    .filter((p) => /@(Post|Get|Patch|Delete|Put)\(/.test(p))
    .map((p) => ({ head: p.split('\n')[1] ?? p.split('\n')[0], body: p }));
}

describe('CSRF-трипваер auth.controller', () => {
  const blocks = handlerBlocks(src);

  it('нашлись хендлеры (санити парсера)', () => {
    expect(blocks.length).toBeGreaterThan(5);
  });

  // ЧИТАНИЕ refresh-куки для аутентификации изменяющего состояние действия
  // (не установка её при логине — та защищена oauth-state). Паттерны чтения:
  // `req.cookies?.[REFRESH_COOKIE]` или `getCookie(req, REFRESH_COOKIE)`.
  const READ_REFRESH =
    /(cookies\??\.?\[?\s*|getCookie\([^,]+,\s*)REFRESH_COOKIE/;
  it('каждый хендлер, ЧИТАЮЩИЙ REFRESH_COOKIE, зовёт requireCsrf', () => {
    const readers = blocks.filter((b) => {
      // читает (req.cookies[...] или getCookie(req, ...)), а не только
      // устанавливает res.cookie(REFRESH_COOKIE, ...).
      const reads = [...b.body.matchAll(/REFRESH_COOKIE/g)].some((m) => {
        const before = b.body.slice(Math.max(0, m.index - 30), m.index);
        return /req\.cookies|getCookie\(/.test(before);
      });
      return reads;
    });
    // санити: refresh и logout — точно среди читателей
    expect(readers.length).toBeGreaterThanOrEqual(2);
    const offenders = readers
      .filter((b) => !b.body.includes('requireCsrf'))
      .map((b) => b.head.trim());
    expect(offenders).toEqual([]);
    expect(READ_REFRESH.test(src)).toBe(true);
  });

  it('requireCsrf: зовёт hasCsrfHeader и бросает UnauthorizedException', () => {
    const m = src.match(
      /private requireCsrf[\s\S]*?throw new UnauthorizedException\([^)]*\)/,
    );
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/hasCsrfHeader/);
    expect(m![0]).toMatch(/csrf_blocked/); // аудит-событие
  });

  it('hasCsrfHeader реально проверяет заголовок, а не заглушка true', () => {
    const m = src.match(/function hasCsrfHeader[\s\S]*?\n}/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/x-requested-with|CSRF_HEADER/);
    expect(m![0]).not.toMatch(/^\s*return true;\s*$/m); // не безусловный true
  });

  it('ни одна кука не выставлена sameSite:none (кросс-сайт отправка)', () => {
    expect(src).not.toMatch(/sameSite:\s*['"]none['"]/i);
  });

  it('REFRESH_COOKIE выставляется httpOnly и sameSite strict', () => {
    // cookieOptions — источник флагов рефреш-куки.
    const co = src.match(/function cookieOptions[\s\S]*?\n}/);
    expect(co).not.toBeNull();
    expect(co![0]).toMatch(/httpOnly:\s*true/);
    expect(co![0]).toMatch(/sameSite:\s*['"]strict['"]/);
  });
});
