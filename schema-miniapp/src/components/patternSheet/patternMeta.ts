// Метаданные паттерна (название/цвет/подпись) для схемы или режима — общая
// точка резолва для useMyCards и PatternSheet (правило №11: не дублировать
// логику поиска схемы/режима по id в нескольких местах).
import { SCHEMA_DOMAINS, getModeById } from '../../schemaTherapyData';

export interface PatternMeta {
  name: string;
  color: string;
  subtitle?: string;
}

export function schemaMeta(schemaId: string): PatternMeta | null {
  for (const d of SCHEMA_DOMAINS) {
    const s = d.schemas.find((x) => x.id === schemaId);
    if (s) return { name: s.name, color: d.color, subtitle: d.domain };
  }
  return null;
}

export function modeMeta(modeId: string): PatternMeta | null {
  const m = getModeById(modeId);
  return m
    ? { name: m.name, color: m.groupColor, subtitle: m.groupName }
    : null;
}

export function patternMeta(
  kind: 'schema' | 'mode',
  id: string,
): PatternMeta | null {
  return kind === 'schema' ? schemaMeta(id) : modeMeta(id);
}
