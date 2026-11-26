// Записи реестра env-переменных (см. env-registry.ts) — группа channel:
// автопостинг канала «Здоровый Взрослый» (src/channel/targets/*).
import { EnvVarSpec, formats } from './env-registry';

export const CHANNEL_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'HEALTHY_ADULT_CHANNEL',
    purpose:
      'Telegram-канал (@username или -100…id) — без него площадка Telegram выключена.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_MAX_CA',
    purpose:
      'Перекрытие корневого сертификата для запросов в MAX — по умолчанию ' +
      'берётся из репозитория (assets/ca), переменная нужна только для смены без деплоя.',
    requiredInProd: false,
    format: formats.any,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_MAX_CHAT',
    purpose:
      'Id чата/канала MAX для публикации — без него площадка MAX выключена.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_MAX_TOKEN',
    purpose:
      'Токен бота MAX — постит в канал И подписывает initData мини-аппа MAX ' +
      '(один бот на обе роли, см. CLAUDE.md).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_PINTEREST_BOARD',
    purpose: 'Id доски Pinterest — без него площадка Pinterest выключена.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_PINTEREST_TOKEN',
    purpose: 'Токен доступа Pinterest API.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_THREADS_RELAY',
    purpose:
      'Адрес ретранслятора Threads (Cloudflare Worker) — без него запросы идут ' +
      'напрямую в graph.threads.net (недоступен с российского хостинга).',
    requiredInProd: false,
    format: formats.url,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_THREADS_RELAY_SECRET',
    purpose:
      'Секрет для ретранслятора Threads — без него ретранслятор отвечает 403.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_THREADS_TOKEN',
    purpose:
      'Стартовый токен Threads — актуальный живёт в БД и обновляется кроном, ' +
      'эта переменная нужна только один раз при первом подключении.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_THREADS_USER',
    purpose:
      'Id пользователя Threads (или «me») — без него площадка Threads выключена.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_VK_GROUP',
    purpose: 'Id сообщества ВКонтакте — без него площадка VK выключена.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
  {
    name: 'HEALTHY_ADULT_VK_TOKEN',
    purpose: 'Ключ доступа сообщества VK (права «Стена»).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'channel',
  },
];
