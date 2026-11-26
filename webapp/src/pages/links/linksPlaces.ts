// Площадки-зеркала пунктов страницы ссылок: одно и то же в разных соцсетях —
// значки внутри пункта, а не отдельные кнопки.
import { botUrl } from '../../utils/botConfig';
import type { PlaceLink } from './linksModel';

/** Боты приложения «Всё по схеме». */
export const PROJECT_PLACES: readonly PlaceLink[] = [
  { id: 'project_tg', title: 'Telegram', href: botUrl },
  { id: 'project_max', title: 'MAX', href: 'https://max.ru/se13646337_bot' },
];

// Адрес литералом: импорт shared/src/share/channelLinks тянет чанк шаринга в стартовую загрузку.
export const HEALTHY_ADULT_PLACES: readonly PlaceLink[] = [
  { id: 'channel_ha', title: 'Telegram', href: 'https://t.me/MyHealthyAdult' },
  { id: 'ha_threads', title: 'Threads', href: 'https://www.threads.com/@yourhealthyadult' },
  { id: 'ha_vk', title: 'ВКонтакте', href: 'https://vk.ru/healthyadult' },
  { id: 'ha_max', title: 'MAX', href: 'https://max.ru/join/I-uqSia8bTFSfwNswMeNIDTKcbydSmUntfPcVMEz2Ts' },
];

export const SCHEMA_CHANNEL_PLACES: readonly PlaceLink[] = [
  { id: 'channel_schema', title: 'Telegram', href: 'https://t.me/SchemeHappens' },
  { id: 'schema_max', title: 'MAX', href: 'https://max.ru/se13646337_biz' },
];
