import { getSchemaById } from '../../schemaTherapyData';
import type { Draft } from './modeDraft';

// Формат узла схемы — как у conceptToModeMap: тип schema, название и schemaId.
// Его же узнаёт синхронизация холста с концептуализацией (canvasConcept).
export const schemaNode = (schemaId: string, label: string, color: string): Draft => ({
  id: `schema_${schemaId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
  type: 'schema', data: { label, schemaId, customColor: color },
});

export const schemaDraft = (schemaId: string): Draft | null => {
  const s = getSchemaById(schemaId);
  return s ? schemaNode(schemaId, s.name, s.domainColor) : null;
};
