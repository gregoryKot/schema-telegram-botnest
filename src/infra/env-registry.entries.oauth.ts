// Записи реестра env-переменных (см. env-registry.ts) — вход через внешние
// сервисы: VK ID и Яндекс ID. Группа — auth: записи подключаются в
// AUTH_ENV_ENTRIES (env-registry.entries.auth.ts). Все необязательные: без
// переменных провайдера старт не падает, а вход через него выключен рубильником
// (src/auth/oauth-provider-switch.ts).
import { EnvVarSpec, FormatValidator, formats } from './env-registry';

/** ClientID Яндекс ID — 32 hex-символа (записано 2026-11-12, yandex-id-oauth.json). */
const yandexClientId: FormatValidator = (value) =>
  /^[0-9a-f]{32}$/i.test(value)
    ? null
    : `ожидалось 32 hex-символа (ClientID из кабинета oauth.yandex.ru), получено ${value.length}`;

export const OAUTH_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'VK_APP_ID',
    purpose:
      'OAuth client id входа через VK ID. Рубильник: без него (или без `VK_REDIRECT_URI`) вход через VK выключен — кнопка остаётся, нажатие ведёт на экран «Вход через ВКонтакте отключён» (`src/auth/oauth-provider-switch.ts`).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'VK_REDIRECT_URI',
    purpose:
      'Адрес возврата VK после входа — обязан вести на канонический хост.',
    requiredInProd: false,
    format: formats.httpsUrl,
    group: 'auth',
  },
  {
    name: 'YANDEX_CLIENT_ID',
    purpose:
      'ClientID приложения Яндекс ID (кабинет oauth.yandex.ru) — вход через Яндекс. Рубильник: без него (или без `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`) вход через Яндекс выключен — нажатие ведёт на экран ошибки входа с причиной `yandex_disabled` (`src/auth/oauth-provider-switch.ts`).',
    requiredInProd: false,
    format: yandexClientId,
    group: 'auth',
  },
  {
    name: 'YANDEX_CLIENT_SECRET',
    purpose:
      'Client secret того же приложения Яндекс ID — им сервер обменивает код входа на токен; в браузер не попадает.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'YANDEX_REDIRECT_URI',
    purpose:
      'Адрес возврата Яндекса после входа (Redirect URI в кабинете приложения) — обязан вести на канонический хост.',
    requiredInProd: false,
    format: formats.httpsUrl,
    group: 'auth',
  },
];
