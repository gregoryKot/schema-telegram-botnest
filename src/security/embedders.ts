// Реестр площадок, которые открывают наше мини-приложение в своём <iframe>.
//
// Из него строятся ДВА места, обязанные совпадать (правило №4 CLAUDE.md):
//  - CSP `frame-ancestors` (src/security/helmet-config.ts) — кого браузер
//    пустит быть родителем нашего iframe;
//  - сверка кросс-сайтовых кук (`SameSite=None`, src/auth/auth-http.util.ts) —
//    сессия, выданная внутри чужого iframe, без этого флага не продлевается;
//    тест csrf.invariants.spec.ts требует, чтобы каждая точка входа с такой
//    кукой принадлежала площадке из этого списка.
//
// До аудита 2026-10-11 это были два независимых списка, и они разошлись:
// кука «для Telegram Web в iframe» заводилась, а CSP Telegram Web не пускал —
// мини-апп в web.telegram.org не отрисовывался («Refused to frame»), сервер
// при этом отвечал 200 и никакого сигнала наверх не было.
//
// Нативные вебвью (Telegram iOS/Android/Desktop) сюда не входят: они не
// встраивают страницу в iframe, ограничение frame-ancestors к ним не
// применяется.

export interface Embedder {
  /** Стабильный идентификатор для тестов-сверок. */
  readonly name: string;
  /** Origin'ы родительской страницы — как их понимает CSP (источник хоста). */
  readonly origins: readonly string[];
  /**
   * Сессия внутри этой площадки живёт в кросс-сайтовом iframe, поэтому
   * refresh-кука выдаётся с `SameSite=None` (см. cookieOptions).
   */
  readonly crossSiteSession: boolean;
}

export const EMBEDDERS: readonly Embedder[] = [
  {
    // Мини-приложение MAX открывается iframe'ом на max.ru и поддоменах.
    name: 'max',
    origins: ['https://max.ru', 'https://*.max.ru'],
    crossSiteSession: true,
  },
  {
    // Telegram Web показывает Mini App в <iframe>. SDK площадки
    // (webapp/public/telegram-web-app.js, ветка isIframe) знает только
    // `https://web.telegram.org`, но живые хосты клиентов шире — проверено
    // curl'ом 2026-10-14:
    //  - web.telegram.org — основной хост (клиент K на /k/, A на /a/);
    //  - webk.telegram.org — отдаёт полный клиент Web K (200), без редиректа
    //    на хост выше: человек, открывший закладку webk., остаётся на нём;
    //  - weba.telegram.org — клиент Web A (200); его redirect.js уводит на
    //    web.telegram.org/a только если в localStorage нет `tt-global-state`,
    //    то есть вернувшийся пользователь остаётся на weba.;
    //  - webz.telegram.org отвечает 301 на weba., сам родителем не бывает —
    //    не включён.
    // `*.telegram.org` шире нужного — под ним живут и другие поддомены
    // площадки (core., oauth., desktop. и т.д.), которым встраивать нас
    // незачем. Появится доказанный случай встраивания с другого хоста —
    // допиши его сюда вместе с пином в frame-ancestors.invariants.spec.ts.
    name: 'telegram-web',
    origins: [
      'https://web.telegram.org',
      'https://webk.telegram.org',
      'https://weba.telegram.org',
    ],
    crossSiteSession: true,
  },
];

/** Значение для CSP `frame-ancestors`: сам сайт плюс все встраиватели. */
export function frameAncestors(): string[] {
  return ["'self'", ...EMBEDDERS.flatMap((e) => e.origins)];
}
