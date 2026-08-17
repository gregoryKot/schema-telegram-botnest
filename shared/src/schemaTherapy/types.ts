/**
 * Типы контента схема-терапии (эмоции, 20 схем / 5 доменов, 35 режимов) —
 * общие для webapp и schema-miniapp (правило №3 CLAUDE.md). Сам текст — в
 * shared/src/schemaTherapy/content/*, сборка — в
 * shared/src/schemaTherapy/schemaTherapyData.ts.
 */

export interface Emotion {
  id: string;
  label: string;
  emoji: string;
}

export interface Schema {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  libraryDesc: string;
}

export interface SchemaDomain {
  id: string;
  domain: string;
  color: string;
  schemas: Schema[];
}

export interface Mode {
  id: string;
  name: string;
  emoji: string;
  short: string;
}

export interface ModeGroup {
  id: string;
  group: string;
  color: string;
  items: Mode[];
}
