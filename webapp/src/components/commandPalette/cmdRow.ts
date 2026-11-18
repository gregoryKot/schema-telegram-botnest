// Строка общего поиска (палитра ⌘K): что рисует список (CommandPaletteList.tsx) и что собирают
// модули строк (paletteRows.ts и соседи).
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { SearchResultKind } from '../../../../shared/src/share/searchAnalytics';

export type CmdMark = { sign: SignKey } | { initials: string; hue: number };
export interface CmdRow {
  /** Стабильный ключ строки (тип + id, без имён): по нему строка попадает в «Недавнее». */
  key: string;
  /** Вид строки — для события открытия результата (search_result_open). */
  kind: SearchResultKind;
  /** Подпись группы над первой строкой группы. */
  group: string;
  label: string;
  sub?: string;
  hint?: string;
  mark: CmdMark;
  /** Текст, по которому ищется строка (подпись, подзаголовок и группа). */
  search: string;
  action: () => void;
  /** Приглушённая строка под этой («Ещё N — начни вводить имя»): не выбирается. */
  after?: string;
  /** Строка не закрывает палитру: её действие ведёт ко второму шагу («Кому дать задание?»). */
  stay?: true;
  /** Строка второго шага: открытие посчитано на первом — ни события, ни записи в «Недавнее». */
  transient?: true;
}
