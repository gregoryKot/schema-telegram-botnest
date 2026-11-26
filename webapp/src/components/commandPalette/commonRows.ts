// Строки общего поиска, одинаковые у обеих ролей и режимов: настройки и статьи. Видны только по запросу,
// группа — не больше лимита, лучшие по весу первыми; без запроса их находит по ключу «Недавнее».
import { rankRows } from '../../../../shared/src/search/rankRows';
import { ARTICLE_GROUP, allArticleRows } from './articleRows';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteInput';
import { SETTINGS_GROUP, allSettingRows } from './settingsRows';

export { ARTICLE_GROUP, SETTINGS_GROUP };
/** Сколько строк одной группы видно по запросу. */
export const COMMON_GROUP_SHOWN = 6;

const SOURCES = [allSettingRows, allArticleRows];

export function allCommonRows(input: PaletteInput): CmdRow[] {
  return SOURCES.flatMap((rows) => rows(input));
}

export function commonRows(input: PaletteInput): { row: CmdRow; score: number }[] {
  return SOURCES.flatMap((rows) =>
    rankRows(rows(input), input.query, (row) => ({ label: row.label, text: row.search })).slice(0, COMMON_GROUP_SHOWN));
}
