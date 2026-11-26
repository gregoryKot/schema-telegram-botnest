/**
 * Типы контента схема-терапии (эмоции, 20 схем / 5 доменов, 36 режимов) —
 * общие для webapp (правило №3 CLAUDE.md). Сам текст — в
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
  /** Название по МИСТ (docs/TERMINOLOGY.md), когда `name` короче: в таблетках карты и шапке карточки длинное режет хвост. */
  fullName?: string;
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
