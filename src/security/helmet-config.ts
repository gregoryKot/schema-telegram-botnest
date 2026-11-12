// Настройки helmet (CSP и соседние заголовки) — вынесены из main.ts, чтобы тест
// мог собрать настоящий заголовок на настоящем express-приложении (supertest),
// а не искать регэкспом по исходнику (правило №14: тест на шве).
import type { HelmetOptions } from 'helmet';
import { frameAncestors } from './embedders';

export function helmetOptions(): HelmetOptions {
  return {
    // Allow cross-origin loading of static assets (og:image, fonts, etc.)
    // so Telegram/VK/WhatsApp preview crawlers and tools like metatags.io can fetch them.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // st.max.ru — мост мини-приложения MAX (их документация требует
        // грузить его с этого CDN). Без него мост молча не загрузится, а
        // приложение внутри MAX решит, что открыто в обычном браузере.
        // telegram.org не нужен: SDK мини-приложения (telegram-web-app.js) отдаём сами.
        scriptSrc: ["'self'", 'https://mc.yandex.ru', 'https://st.max.ru'],
        connectSrc: ["'self'", 'https://mc.yandex.ru'],
        imgSrc: ["'self'", 'data:', 'https://mc.yandex.ru', 'https://t.me'],
        // Чужих фреймов на страницах нет. Хостов Google и Telegram (в том
        // числе oauth.telegram.org — виджет и редирект входа) здесь нет
        // намеренно: вход через них на сайте убран (2026-11, запрос РКН),
        // страница входа к ним не обращается (csp-allowlist.invariants.spec.ts).
        frameSrc: ["'none'"],
        // Кто имеет право встроить нас в свой iframe — реестр площадок
        // src/security/embedders.ts: MAX и Telegram Web (web.telegram.org, Web
        // K/A) открывают мини-приложение именно так, поэтому одного 'self' мало:
        // без их доменов страница не рисуется («Refused to frame»), а сервер
        // при этом отвечает 200. Нативные вебвью Telegram (iOS, Android,
        // Desktop) iframe не используют и этого списка не касаются.
        frameAncestors: frameAncestors(),
        objectSrc: ["'none'"],
        // Upgrade any accidental HTTP sub-resource requests to HTTPS
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    // X-Frame-Options умеет только «никому» или «своему домену» — вписать
    // туда мессенджер нельзя, а SAMEORIGIN перебивал бы список выше в тех
    // браузерах, где живут оба заголовка. Защита от клик-джекинга целиком
    // переезжает в CSP frame-ancestors, который умеет перечислять источники.
    frameguard: false,
  };
}
