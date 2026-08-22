// Security-трипваер: CSRF на изменяющих состояние cookie-эндпоинтах
// (security-таск 2026-07-17). refresh/logout аутентифицируются httpOnly-
// кукой refresh_token — браузер шлёт её автоматически на любой cross-site
// запрос, поэтому без CSRF-проверки злоумышленный сайт мог бы разлогинить
// или провернуть ротацию токена жертвы. Инвариант: каждый хендлер, читающий
// REFRESH_COOKIE, ПЕРВЫМ делом зовёт requireCsrf; куки не sameSite:none.
//
// 2026-07 (#111): auth.controller распилен на доменные контроллеры, а
// CSRF/cookie-примитивы (requireCsrf, hasCsrfHeader, cookieOptions,
// REFRESH_COOKIE) вынесены в auth-http.util.ts. Трипваер читает util для
// определений примитивов и ВСЕ auth*.controller.ts для блоков-хендлеров.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { cookieOptions } from '../auth/auth-http.util';

const AUTH_DIR = join(__dirname, '../auth');
const UTIL = join(AUTH_DIR, 'auth-http.util.ts');
const util = readFileSync(UTIL, 'utf8');

// Исходники всех auth-контроллеров (auth.controller.ts + auth-*.controller.ts).
const ctrlFiles = readdirSync(AUTH_DIR).filter((f) =>
  /\.controller\.ts$/.test(f),
);
const ctrlSrc = ctrlFiles
  .map((f) => readFileSync(join(AUTH_DIR, f), 'utf8'))
  .join('\n');

// Разбиваем на блоки-хендлеры по декораторам маршрутов.
function handlerBlocks(text: string): { head: string; body: string }[] {
  const parts = text.split(/\n(?=\s*@(?:Post|Get|Patch|Delete|Put)\()/);
  return parts
    .filter((p) => /@(Post|Get|Patch|Delete|Put)\(/.test(p))
    .map((p) => ({ head: p.split('\n')[1] ?? p.split('\n')[0], body: p }));
}

describe('CSRF-трипваер auth-контроллеры', () => {
  const blocks = handlerBlocks(ctrlSrc);

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
    expect(READ_REFRESH.test(ctrlSrc)).toBe(true);
  });

  it('requireCsrf: зовёт hasCsrfHeader и бросает UnauthorizedException', () => {
    const m = util.match(
      /function requireCsrf[\s\S]*?throw new UnauthorizedException\([^)]*\)/,
    );
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/hasCsrfHeader/);
    expect(m![0]).toMatch(/csrf_blocked/); // аудит-событие
  });

  it('hasCsrfHeader реально проверяет заголовок, а не заглушка true', () => {
    const m = util.match(/function hasCsrfHeader[\s\S]*?\n}/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/x-requested-with|CSRF_HEADER/);
    expect(m![0]).not.toMatch(/^\s*return true;\s*$/m); // не безусловный true
  });

  // sameSite:none снимает главную защиту от CSRF, поэтому появляться он имеет
  // право ровно в одном месте — в cookieOptions, под явным флагом crossSite, и
  // только ради мессенджера, который открывает мини-апп в чужом iframe (MAX:
  // оттуда браузер strict-куку не шлёт вовсе). Контроллерам ставить none
  // напрямую по-прежнему нельзя: тогда ослабление расползётся молча.
  it('sameSite:none живёт только в cookieOptions под флагом crossSite', () => {
    expect(ctrlSrc).not.toMatch(/sameSite:\s*['"]none['"]/i);

    const noneHits = util.match(/sameSite:[^\n]*['"]none['"]/gi) ?? [];
    expect(noneHits).toHaveLength(1);
    // Не безусловный none: строка обязана быть ветвлением по crossSite.
    expect(noneHits[0]).toMatch(/opts\.crossSite\s*\?/);
  });

  it('REFRESH_COOKIE выставляется httpOnly, а strict — поведение по умолчанию', () => {
    // cookieOptions — источник флагов рефреш-куки.
    const co = util.match(/export function cookieOptions[\s\S]*?\n}/);
    expect(co).not.toBeNull();
    expect(co![0]).toMatch(/httpOnly:\s*true/);
    expect(co![0]).toMatch(/secure:\s*true/);
    // Без crossSite всегда strict — новый флаг не должен уметь переворачивать
    // дефолт (иначе весь сайт тихо переехал бы на none).
    expect(cookieOptions(100)).toMatchObject({
      sameSite: 'strict',
      httpOnly: true,
      secure: true,
    });
    expect(cookieOptions(100, { crossSite: true })).toMatchObject({
      sameSite: 'none',
    });
  });

  // Кросс-сайтовую сессию (sameSite:none) заводит ровно две точки входа —
  // обе по одной и той же причине: мессенджер грузит мини-апп в iframe, где
  // strict-кука не продлевается.
  //  - auth-max.controller.ts — MAX (был всегда);
  //  - auth-account.controller.ts (POST /api/auth/telegram/webapp) — Telegram
  //    Web (web.telegram.org, Telegram Web A/K) тоже открывает мини-апп в
  //    iframe (2026-08-21, «постоянно нужно логиниться заново»); crossSite
  //    там вычисляется через isCrossSiteRequest(), а не хардкодится.
  // Если crossSite появится в третьем месте, это надо увидеть на ревью —
  // поэтому детектор матчит фактический КОД (crossSite: true/=isCrossSite-
  // Request(...), либо buквальный/переменный 4-й аргумент setRefreshCookie),
  // а не слово «crossSite» где угодно — иначе он ловит и комментарии вроде
  // `// crossSite:false — виджет постится с нашей же страницы (fetch)`.
  function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }
  const CROSS_SITE_CODE =
    /crossSite\s*[:=]\s*(true\b|isCrossSiteRequest\()|setRefreshCookie\([^)]*,\s*(true|crossSite)\s*\)/;
  function usesCrossSite(code: string): boolean {
    return CROSS_SITE_CODE.test(stripComments(code));
  }

  it('гейт ловит факт. код, а не слово «crossSite» в комментарии (сэндбокс)', () => {
    // Контрольный "законный" образец: комментарий с crossSite:false и
    // жёстко false в коде — не должен триггерить (реальный кейс
    // auth-telegram.controller.ts).
    const commentOnly = `
      // crossSite:false — виджет постится с нашей же страницы (fetch), не iframe.
      setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
    `;
    expect(usesCrossSite(commentOnly)).toBe(false);

    // Контрольный "незаконный" образец: третий контроллер реально включил
    // crossSite — обязан продолжать краснеть.
    const thirdControllerLiteral = `
      setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, true);
    `;
    expect(usesCrossSite(thirdControllerLiteral)).toBe(true);

    const thirdControllerComputed = `
      const crossSite = isCrossSiteRequest(req, webappUrl);
      setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, crossSite);
    `;
    expect(usesCrossSite(thirdControllerComputed)).toBe(true);
  });

  it('crossSite включает только обмен подписи MAX и Telegram Web (webapp)', () => {
    const optedIn = ctrlFiles
      .filter((f) => usesCrossSite(readFileSync(join(AUTH_DIR, f), 'utf8')))
      .sort();
    expect(optedIn).toEqual(
      ['auth-account.controller.ts', 'auth-max.controller.ts'].sort(),
    );
  });
});
