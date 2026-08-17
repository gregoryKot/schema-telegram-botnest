import type { Schema, Mode } from './types';
import { EMOTIONS, INTENSITY_LABELS } from './content/emotions';
import { SCHEMA_DOMAINS } from './content/schemaDomains';
import { MODE_GROUPS } from './content/modeGroups';

// Единственный источник контента схема-терапии (правило №3 CLAUDE.md):
// раньше это были две побайтово идентичные копии — webapp/src/schemaTherapyData.ts
// и schema-miniapp/src/schemaTherapyData.ts, дублирование держалось только на
// дисциплине копипаста (аудит парности, PR #349). Оба фронтенда теперь
// ре-экспортируют этот модуль без изменений сигнатур. Сам текст — в
// content/*.ts (эмоции / 20 схем / 35 режимов, правило №10); здесь только
// сборка и производные реестры/хелперы.
export { EMOTIONS, INTENSITY_LABELS, SCHEMA_DOMAINS, MODE_GROUPS };
export type { Schema, SchemaDomain, Mode, ModeGroup, Emotion } from './types';

export interface FlatSchema extends Schema {
  domainColor: string;
  domainId: string;
}

export interface FlatMode extends Mode {
  groupColor: string;
  groupId: string;
  groupName: string;
}

export const ALL_SCHEMAS: FlatSchema[] = SCHEMA_DOMAINS.flatMap((d) =>
  d.schemas.map((s) => ({ ...s, domainColor: d.color, domainId: d.id })),
);

export const ALL_MODES: FlatMode[] = MODE_GROUPS.flatMap((g) =>
  g.items.map((m) => ({
    ...m,
    groupColor: g.color,
    groupId: g.id,
    groupName: g.group,
  })),
);

export function getModeById(id: string): FlatMode | undefined {
  return ALL_MODES.find((m) => m.id === id);
}

export function getSchemaById(id: string): FlatSchema | undefined {
  return ALL_SCHEMAS.find((s) => s.id === id);
}
