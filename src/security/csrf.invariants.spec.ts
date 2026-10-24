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
import { join, relative, sep } from 'path';
import { cookieOptions } from '../auth/auth-http.util';
import { collectSourceFiles } from './collect-source-files';
import { EMBEDDERS } from './embedders';

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

  // Правило №4: кука SameSite=None нужна ровно там, где мессенджер встраивает
  // нас в iframe, а значит, площадка обязана стоять в реестре встраивателей
  // (src/security/embedders.ts) — тогда её же пускает CSP frame-ancestors.
  // Аудит 2026-10-11: кука для Telegram Web была, а CSP его не пускал.
  const CROSS_SITE_ENTRY_TO_EMBEDDER: Record<string, string> = {
    'auth-account.controller.ts': 'telegram-web',
    'auth-max.controller.ts': 'max',
  };

  it('crossSite включает только обмен подписи MAX и Telegram Web (webapp)', () => {
    const optedIn = ctrlFiles
      .filter((f) => usesCrossSite(readFileSync(join(AUTH_DIR, f), 'utf8')))
      .sort();
    expect(optedIn).toEqual(Object.keys(CROSS_SITE_ENTRY_TO_EMBEDDER).sort());
  });

  it('SameSite=None выставляется в одном месте (cookieOptions), а не размазан по контроллерам', () => {
    const withNone = collectSourceFiles(join(__dirname, '..'))
      .filter((f) =>
        /sameSite:\s*[^,\n]*['"]none['"]/.test(
          stripComments(readFileSync(f, 'utf8')),
        ),
      )
      .map((f) => f.slice(join(__dirname, '..').length + 1));
    expect(withNone).toEqual(['auth/auth-http.util.ts']);
  });

  it('каждая точка с SameSite=None принадлежит встраивателю из реестра, и наоборот', () => {
    const byName = new Map(EMBEDDERS.map((e) => [e.name, e]));
    for (const embedderName of Object.values(CROSS_SITE_ENTRY_TO_EMBEDDER)) {
      const e = byName.get(embedderName);
      expect(e).toBeDefined();
      expect(e!.crossSiteSession).toBe(true);
    }
    // Встраиватель, объявивший кросс-сайтовую сессию, обязан иметь точку входа.
    const mapped = new Set(Object.values(CROSS_SITE_ENTRY_TO_EMBEDDER));
    for (const e of EMBEDDERS.filter((x) => x.crossSiteSession)) {
      expect(mapped.has(e.name)).toBe(true);
    }
  });

  // ── Установщики сессии (login-CSRF, аудит 2026-10-11, security#6) ──────────
  // Читатели куки защищены выше. Обратная сторона: хендлер, который СТАВИТ
  // refresh-куку по подписи/коду из тела запроса. Без requireCsrf HTML-форма с
  // чужого сайта (simple request, preflight не нужен) подменяла жертве сессию на
  // сессию атакующего: telegram/webapp, max/webapp и ticket/poll три месяца
  // стояли без проверки, а трипваер смотрел только на читателей.
  // Законных способов быть защищённым два: requireCsrf, либо OAuth-колбэк со
  // сверкой state-куки (assertOAuthStateMatches) — запрос приходит редиректом
  // провайдера, заголовка у него быть не может.
  const WRITES_REFRESH = /setRefreshCookie\(|\.cookie\(\s*REFRESH_COOKIE/;
  const SESSION_GUARD = /\brequireCsrf\(|\bassertOAuthStateMatches\(/;

  /** Человекочитаемое имя хендлера для сообщения об ошибке. */
  const label = (b: { head: string; body: string }): string =>
    b.body.match(/async\s+(\w+)\(/)?.[1] ?? b.head.trim();

  /** Хендлеры, ставящие refresh-куку и не зовущие ни одну из защит. */
  function unguardedWriters(code: string): string[] {
    return handlerBlocks(stripComments(code))
      .filter((b) => WRITES_REFRESH.test(b.body) && !SESSION_GUARD.test(b.body))
      .map(label);
  }

  it('детектор установщиков краснеет на незащищённом и не краснеет на законных (сэндбокс)', () => {
    const base = (guard: string) => `
      @Post('session/new')
      @HttpCode(200)
      async newSession(@Body() dto: Dto, @Req() req: Request, @Res() res: Response) {
        ${guard}
        const tokens = await this.auth.issueTokens(1n);
        setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, false);
      }
    `;
    // Законные образцы.
    expect(unguardedWriters(base("requireCsrf(req, 'x', this.log);"))).toEqual(
      [],
    );
    expect(
      unguardedWriters(base('assertOAuthStateMatches(req, state, origin);')),
    ).toEqual([]);
    // Контрольные: новый установщик без защиты; защита только в комментарии;
    // прямая запись куки в обход setRefreshCookie.
    expect(unguardedWriters(base(''))).toHaveLength(1);
    expect(unguardedWriters(base('// TODO requireCsrf(req)'))).toHaveLength(1);
    expect(
      unguardedWriters(
        base('')
          .replace('setRefreshCookie(res, tokens.refreshToken, 1, false)', '')
          .replace(
            /setRefreshCookie\([^)]*\)/,
            'res.cookie(REFRESH_COOKIE, t)',
          ),
      ),
    ).toHaveLength(1);
  });

  it('каждый хендлер контроллера, ставящий refresh-куку, защищён', () => {
    const offenders: string[] = [];
    let writers = 0;
    for (const f of ctrlFiles) {
      const code = readFileSync(join(AUTH_DIR, f), 'utf8');
      writers += handlerBlocks(stripComments(code)).filter((b) =>
        WRITES_REFRESH.test(b.body),
      ).length;
      offenders.push(...unguardedWriters(code).map((h) => `${f}: ${h}`));
    }
    // санити: telegram/webapp, max/webapp, ticket/poll, widget, merge, 2fa…
    // (было 8: восьмым ставил куку recovery/confirm, убранный в #864).
    expect(writers).toBeGreaterThanOrEqual(7);
    expect(offenders).toEqual([]);
  });

  // Куку может ставить и не контроллер: сервис или хелпер, который тот зовёт.
  // Такой писатель обязан быть заявлен здесь вместе с защитой, которую обязан
  // иметь КАЖДЫЙ его вызывающий хендлер. Новый писатель вне списка краснеет.
  const HELPER_WRITERS: {
    file: string; // относительно src/
    caller: RegExp; // как его зовут из хендлера
    guard: RegExp;
    why: string;
  }[] = [
    {
      file: 'auth/auth-flow.service.ts',
      caller: /\bfinishOAuthRedirect\(/,
      guard: /\bassertOAuthStateMatches\(/,
      why: 'OAuth-колбэки Google/VK: state-кука сверяется до обмена кода',
    },
    {
      file: 'auth/google-one-tap.service.ts',
      caller: /\boneTap\.login\(/,
      guard: /\brequireCsrf\(/,
      why: 'Google One Tap: credential приходит fetch-ом с нашей страницы',
    },
    {
      file: 'auth/email-consume-body.ts',
      caller: /\bemailConsumeBody\(/,
      guard: /\brequireCsrf\(/,
      why: 'email/consume: токен из письма меняется на сессию fetch-ом',
    },
  ];

  function srcFilesWithWriters(): string[] {
    const root = join(__dirname, '..');
    return collectSourceFiles(root)
      .map((p) => relative(root, p).split(sep).join('/'))
      .filter((f) => !/\.controller\.ts$/.test(f))
      .filter((f) => f !== 'auth/auth-http.util.ts')
      .filter((f) =>
        WRITES_REFRESH.test(stripComments(readFileSync(join(root, f), 'utf8'))),
      )
      .sort();
  }

  it('писатели куки вне контроллеров — только заявленные хелперы', () => {
    expect(srcFilesWithWriters()).toEqual(
      HELPER_WRITERS.map((h) => h.file).sort(),
    );
  });

  it.each(HELPER_WRITERS)(
    'вызывающие $file защищены ($why)',
    ({ caller, guard }) => {
      const callers: string[] = [];
      const bad: string[] = [];
      for (const f of ctrlFiles) {
        const code = stripComments(readFileSync(join(AUTH_DIR, f), 'utf8'));
        for (const b of handlerBlocks(code)) {
          if (!caller.test(b.body)) continue;
          callers.push(`${f}: ${label(b)}`);
          if (!guard.test(b.body)) bad.push(`${f}: ${label(b)}`);
        }
      }
      expect(callers.length).toBeGreaterThan(0); // санити: хелпер кем-то зовётся
      expect(bad).toEqual([]);
    },
  );

  // Google-колбэк зовёт flow.oauthCallback, а не finishOAuthRedirect напрямую:
  // защита живёт внутри метода и обязана стоять ДО выдачи сессии.
  it('oauthCallback сверяет state-куку раньше, чем выдаёт сессию', () => {
    const flow = stripComments(
      readFileSync(join(AUTH_DIR, 'auth-flow.service.ts'), 'utf8'),
    );
    const body = flow.slice(flow.indexOf('async oauthCallback('));
    const guard = body.indexOf('assertOAuthStateMatches(');
    const issue = body.indexOf('finishOAuthRedirect(');
    expect(guard).toBeGreaterThan(-1);
    expect(issue).toBeGreaterThan(guard);
  });
});
