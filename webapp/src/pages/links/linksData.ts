// Кнопки страницы ссылок kotlarewski.gr/links — сверху вниз. Поменять адрес или
// подпись — правка одной строки здесь; id — из общего списка с сервером.
import type { LinksPageTarget } from '../../../../shared/src/analytics/linksPage';
import { TG_URL } from '../landing/constants';

export interface LinkItem {
  id: LinksPageTarget;
  title: string;
  /** Вторая строка — только у записи и у карточки проекта. */
  note?: string;
  /** null — адреса пока нет, кнопка не показывается. */
  href: string | null;
  /** primary — главная кнопка (одна), feature — карточка проекта, plain — остальные. */
  kind: 'primary' | 'feature' | 'plain';
}

export const LINKS: readonly LinkItem[] = [
  { id: 'booking', kind: 'primary', title: 'Записаться на консультацию', note: 'Первая встреча бесплатно · 15 минут', href: '/#booking' },
  { id: 'project', kind: 'feature', title: 'Всё по схеме', note: 'Бесплатное приложение самопомощи по схема-терапии: трекер потребностей, дневники, тест схем', href: 'https://schemehappens.ru' },
  { id: 'channel_ha', kind: 'plain', title: 'Канал «Здоровый Взрослый»', href: null }, // адрес от владельца
  { id: 'channel_schema', kind: 'plain', title: 'Канал о схема-терапии', href: 'https://t.me/SchemeHappens' },
  { id: 'about', kind: 'plain', title: 'Обо мне и как я работаю', href: '/' },
  { id: 'articles', kind: 'plain', title: 'Статьи', href: '/articles' },
  { id: 'write', kind: 'plain', title: 'Написать лично', href: TG_URL },
];

export type ReadyLink = LinkItem & { href: string };

/** Кнопки с адресом — то, что рисует страница. */
export const readyLinks = (links: readonly LinkItem[] = LINKS): ReadyLink[] =>
  links.filter((l): l is ReadyLink => l.href !== null);
