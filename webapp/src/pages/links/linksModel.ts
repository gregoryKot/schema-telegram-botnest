// Модель страницы ссылок: пункт — название, подпись, основная ссылка и ярлычки
// площадок-зеркал. Ссылка без адреса не рисуется; пункт без ссылок скрыт.
import type { LinksPageTarget } from '../../../../shared/src/analytics/linksPageTargets';

type Linked = { id: LinksPageTarget; href: string | null };

/** Ярлычок площадки: подпись — её название, цель клика своя. */
export interface PlaceLink extends Linked {
  title: 'Telegram' | 'MAX' | 'Threads' | 'ВКонтакте';
}

export interface LinkItem {
  /** primary — главная кнопка (одна), feature — карточка проекта, plain — остальные. */
  kind: 'primary' | 'feature' | 'plain';
  title: string;
  /** Вторая строка — что это. */
  note?: string;
  /** Основная ссылка пункта; нет поля — пункт ведёт только ярлычками. null — адреса пока нет. */
  main?: Linked;
  /** Подпись над ярлычками, когда из названия неясно, куда они ведут. */
  placesLabel?: string;
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

/** Все ссылки пункта в порядке показа: основная, затем ярлычки. */
export const itemLinks = (l: ReadyLink): Ready<Linked>[] => [...(l.main ? [l.main] : []), ...l.places];
