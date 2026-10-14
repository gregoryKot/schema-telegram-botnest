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
    // Telegram Web (версии K и A) показывает Mini App в <iframe>, родитель —
    // https://web.telegram.org. Источник: собственный SDK площадки
    // (webapp/public/telegram-web-app.js, ветка isIframe: проверка
    // `event.origin === 'https://web.telegram.org'`). Оба клиента — K
    // (/k/) и A (/a/) — живут на этом одном хосте, пути в CSP не нужны.
    // Альтернативные хосты (webk./webz./weba.telegram.org) НЕ включены: SDK
    // площадки знает только web.telegram.org, а те адреса исторически ведут
    // на него редиректом, то есть родителем iframe остаётся он. Появится
    // доказанный случай встраивания с другого хоста — допиши его сюда
    // вместе с тестом. `*.telegram.org` шире
    // нужного — под ним живут и другие поддомены площадки (core., oauth.,
    // desktop. и т.д.), которым встраивать нас незачем.
    name: 'telegram-web',
    origins: ['https://web.telegram.org'],
    crossSiteSession: true,
  },
];

/** Значение для CSP `frame-ancestors`: сам сайт плюс все встраиватели. */
export function frameAncestors(): string[] {
  return ["'self'", ...EMBEDDERS.flatMap((e) => e.origins)];
}
