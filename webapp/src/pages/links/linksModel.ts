// Модель страницы ссылок: пункт — название, подпись, основная ссылка и значки
// площадок-зеркал. Ссылка без адреса не рисуется; пункт без ссылок скрыт.
import type { LinksPageTarget } from '../../../../shared/src/analytics/linksPageTargets';

type Linked = { id: LinksPageTarget; href: string | null };

/** Значок площадки: по названию выбирается знак, цель клика своя. */
export interface PlaceLink extends Linked {
  title: 'Telegram' | 'MAX' | 'Threads' | 'ВКонтакте';
}

export interface LinkItem {
  /** primary — главная кнопка (одна), feature — карточка проекта, note — жёлтая записка, plain — остальные. */
  kind: 'primary' | 'feature' | 'note' | 'plain';
  title: string;
  /** Вторая строка — что это. */
  note?: string;
  /** Карточка проекта: подпись кнопки-действия. */
  cta?: string;
  /** Основная ссылка пункта; нет поля — пункт ведёт только значками. null — адреса пока нет. */
  main?: Linked;
  /** Что открывают значки, для их доступного имени («… в Telegram»); по умолчанию — название. */
  placesName?: string;
  places?: readonly PlaceLink[];
}

type Ready<T extends Linked> = T & { href: string };
export type ReadyLink = Omit<LinkItem, 'main' | 'places'> & { main?: Ready<Linked>; places: Ready<PlaceLink>[] };

const hasHref = <T extends Linked>(l: T): l is Ready<T> => l.href !== null;

/** То, что рисует страница: ссылки с адресом; пункт, которому некуда вести, скрыт. */
export const readyLinks = (links: readonly LinkItem[]): ReadyLink[] =>
  links.flatMap((l): ReadyLink[] => {
    const { main, places = [], ...rest } = l;
    const item: ReadyLink = { ...rest, places: places.filter(hasHref) };
    if (main && hasHref(main)) item.main = main;
    return item.main || item.places.length ? [item] : [];
  });

/** Все ссылки пункта в порядке показа: основная, затем значки. */
export const itemLinks = (l: ReadyLink): Ready<Linked>[] => [...(l.main ? [l.main] : []), ...l.places];
