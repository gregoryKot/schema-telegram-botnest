// Схемы и режимы «Паттернов» и упражнения «Практик» в общем поиске клиента: статические каталоги,
// ищутся по названию. Строка ведёт в раздел с состоянием маршрута (patternRoute.ts, practiceRoute.ts).
import { EXERCISES } from '../../../../shared/src/exercises/exerciseCatalog';
import { ALL_MODES, ALL_SCHEMAS, SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SECTION_LOOK } from '../appShell/navLook';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteInput';

export const SCHEMA_GROUP = 'Схемы';
export const MODE_GROUP = 'Режимы';
export const EXERCISE_GROUP = 'Упражнения';

const DOMAIN_NAME = new Map(SCHEMA_DOMAINS.map((d) => [d.id, d.domain]));

export function allSchemaRows({ run }: PaletteInput): CmdRow[] {
  return ALL_SCHEMAS.map((s) => ({
    key: `pattern:schema:${s.id}`, kind: 'pattern', group: SCHEMA_GROUP, label: s.name, sub: DOMAIN_NAME.get(s.domainId),
    mark: { sign: ENTITY_LOOK.schemas.sign }, search: `${s.name} ${s.fullName ?? ''}`.trim(),
    action: () => run.pattern({ kind: 'schema', id: s.id }),
  }));
}

export function allModeRows({ run }: PaletteInput): CmdRow[] {
  return ALL_MODES.map((m) => ({
    key: `pattern:mode:${m.id}`, kind: 'pattern', group: MODE_GROUP, label: m.name, sub: m.groupName,
    mark: { sign: ENTITY_LOOK.modes.sign }, search: m.name,
    action: () => run.pattern({ kind: 'mode', id: m.id }),
  }));
}

export function allExerciseRows({ run }: PaletteInput): CmdRow[] {
  return EXERCISES.map((e) => ({
    key: `exercise:${e.id}`, kind: 'exercise', group: EXERCISE_GROUP, label: e.title, sub: e.time,
    mark: { sign: SECTION_LOOK.practice.sign }, search: e.title,
    action: () => run.practice({ kind: 'exercise', id: e.id }),
  }));
}
