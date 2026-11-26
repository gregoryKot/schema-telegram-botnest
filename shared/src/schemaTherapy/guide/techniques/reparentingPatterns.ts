import { playAndJoyMore as playBase } from './childCareMore';
import { limitedReparentingMoreAll } from './reparentingHeath';
import { limitedReparentingHeathMore } from './reparentingPatternsHeath';

export * from './childCareMore';

/** «Подробнее» к limited_reparenting и play_and_joy по семи паттернам заботы [Хис, гл. 4]: вынесено, чтобы файлы не росли. */
export const limitedReparentingMoreFull: string[] = [
  ...limitedReparentingMoreAll,
  'Доступность по договорённости [Хис, гл. 4]. В трудный период терапевт заранее оговаривает, как с ним связаться: несколько звонков, письма, переходный объект, песня или картинка между сессиями. Это «круглосуточная доступность» родителя, но в рамках, о которых договорились; при самоповреждении такая связь помогает отказаться от разрушительного копинга.',
  ...limitedReparentingHeathMore,
];

export const playAndJoyMore: string[] = [
  ...playBase,
  'Лёгкость как паттерн заботы [Хис, гл. 4]. У Локвуд и Сэмсон игра и спонтанность — отдельный позитивный родительский паттерн: утешение снимает боль, а общая радость строит надёжную привязанность. Если детская часть в образе прячется и не хочет говорить о страхе, терапевт может присоединиться к её игре или рисунку и так мягко обойти Отстранённого Защитника.',
];
