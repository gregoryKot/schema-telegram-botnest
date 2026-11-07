// Счётчики двух каталогов раздела «Практики» — «Что питает» (свои маленькие
// действия по потребностям, таблица UserPractice) и «Планы» (за 30 дней). Одна
// подпись на «Инструменты» (toolRows.ts) и строку «Каталогов»
// (webapp/src/sections/practice/catalogCounts.ts): раньше слова жили копией в
// обоих местах, и переименование каталога из «Практик» пришлось бы делать дважды.
import { pluralRu as plural } from '../utils/pluralRu';

/** «Что питает»: «3 действия»; ноль — «Пока пусто», а не «0 действий». */
export function practiceCountLabel(count: number): string {
  return count === 0
    ? 'Пока пусто'
    : `${count} ${plural(count, 'действие', 'действия', 'действий')}`;
}

/** «Планы»: «2 плана»; ноль — «История пуста». */
export function planCountLabel(count: number): string {
  return count === 0
    ? 'История пуста'
    : `${count} ${plural(count, 'план', 'плана', 'планов')}`;
}
