// Строки общего поиска только режима клиента: свои задания, упражнения, схемы и режимы, свои планы.
// Группа по запросу — не больше лимита, лучшие по весу первыми; при равном весе порядок модуля строк.
import { rankRowsWithAliases } from '../../../../shared/src/search/aliasScore';
import type { CmdRow } from './cmdRow';
import { allOwnTaskRows, allPlanRows } from './ownRows';
import type { PaletteInput } from './paletteInput';
import { allExerciseRows, allModeRows, allSchemaRows } from './patternRows';

/** Сколько строк одной группы видно по запросу. */
export const CLIENT_GROUP_SHOWN = 6;

const SOURCES = [allOwnTaskRows, allExerciseRows, allSchemaRows, allModeRows, allPlanRows];

/** Всё, что клиент может открыть, — среди этого «Недавнее» находит строку по ключу. */
export function allClientModeRows(input: PaletteInput): CmdRow[] {
  return SOURCES.flatMap((rows) => rows(input));
}

export function clientModeRows(input: PaletteInput): { row: CmdRow; score: number }[] {
  return SOURCES.flatMap((rows) =>
    rankRowsWithAliases(rows(input), input.query, (row) => ({ label: row.label, text: row.search, aliases: row.aliases })).slice(0, CLIENT_GROUP_SHOWN));
}
