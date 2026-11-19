// Пункты страницы ссылок kotlarewski.gr/privet — сверху вниз. Поменять адрес или
// подпись — правка одной строки здесь или в linksPlaces.ts (площадки-зеркала).
import { TG_URL } from '../landing/constants';
import type { LinkItem } from './linksModel';
import { HEALTHY_ADULT_PLACES, PROJECT_PLACES, SCHEMA_CHANNEL_PLACES } from './linksPlaces';

export const LINKS: readonly LinkItem[] = [
  { kind: 'primary', title: 'Записаться на консультацию', note: 'Первая встреча бесплатно · 15 минут', main: { id: 'booking', href: '/#booking' } },
  {
    kind: 'feature', title: 'Всё по схеме', main: { id: 'project', href: 'https://schemehappens.ru' },
    note: 'Приложение для себя и рабочий кабинет для терапевтов',
    cta: 'Открыть приложение',
    placesName: 'Бот «Всё по схеме»', places: PROJECT_PLACES,
  },
  {
    kind: 'note', title: 'Здоровый Взрослый', places: HEALTHY_ADULT_PLACES,
    note: 'Та часть внутри, которая заботится о наших потребностях и останавливает Критика. Канал помогает слышать её чаще.',
  },
  { kind: 'plain', title: 'Канал о схема-терапии', places: SCHEMA_CHANNEL_PLACES },
  { kind: 'plain', title: 'Обо мне и как я работаю', main: { id: 'about', href: '/' } },
  { kind: 'plain', title: 'Статьи', main: { id: 'articles', href: '/articles' } },
  { kind: 'plain', title: 'Написать лично', main: { id: 'write', href: TG_URL } },
];
