import { SCHEMA_DOMAINS, ALL_MODES } from '../schemaTherapyData';

const ALL_SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap((d) =>
  d.schemas.map((s) => ({ id: s.id, name: s.name })),
);

/** Человекочитаемое имя задачи по её type/text (карточки схем/режимов). */
export function getTaskDisplayText(type: string, text: string): string {
  if (type === 'schema_intro') {
    const s = ALL_SCHEMAS_FLAT.find((x) => x.id === text);
    return s ? `Карточка схемы: ${s.name}` : 'Карточка схемы';
  }
  if (type === 'mode_intro') {
    const m = ALL_MODES.find((x) => x.id === text);
    return m ? `Карточка режима: ${m.name}` : 'Карточка режима';
  }
  return text;
}
