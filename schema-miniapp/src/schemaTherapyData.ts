// Единственная копия — в shared (правило №3 CLAUDE.md). Раньше этот файл и
// его двойник в webapp были побайтово идентичны (аудит парности PR #349) —
// весь контент схема-терапии теперь живёт в shared/src/schemaTherapy/.
export {
  EMOTIONS,
  INTENSITY_LABELS,
  SCHEMA_DOMAINS,
  MODE_GROUPS,
  ALL_SCHEMAS,
  ALL_MODES,
  getModeById,
  getSchemaById,
} from '../../shared/src/schemaTherapy/schemaTherapyData';
export type {
  Emotion,
  Schema,
  SchemaDomain,
  Mode,
  ModeGroup,
  FlatSchema,
  FlatMode,
} from '../../shared/src/schemaTherapy/schemaTherapyData';
