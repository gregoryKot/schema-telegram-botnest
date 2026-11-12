import { getSchemaById } from '../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { useModeMapConcept, useSchemasOnCanvas } from './clientConceptContext';
import { MAX_SCHEMA_PILLS, linkedSchemaIds, nodeSchemaIds, ownSchemaIds } from './nodeSchemaIds';

interface Props { data: { modeId?: string; schemaId?: string; schemaIds?: string[] }; light?: boolean; fontSize: number }

/**
 * Таблетки схем под текстом узла: свои (панель «Схемы режима») и из концептуализации; максимум три, остальные — «+N».
 * Тихие: светлая бумага и текст --text-sub, домен — точкой его тона (styles/modemap-paper.css), без цветной заливки.
 */
export function SchemaPills({ data, light, fontSize }: Props) {
  const ids = nodeSchemaIds(ownSchemaIds(data), linkedSchemaIds(useModeMapConcept(), data.modeId, useSchemasOnCanvas()));
  if (ids.length === 0) return null;
  const rest = ids.length - MAX_SCHEMA_PILLS;
  return (
    <div className={`mm2-pills${light ? ' is-light' : ''}`} style={{ fontSize }}>
      {ids.slice(0, MAX_SCHEMA_PILLS).map(id => {
        const s = getSchemaById(id)!;
        return (
          <div key={id} className="mm2-pill" style={hueStyle(DOMAIN_HUE[s.domainId])}>
            <i aria-hidden="true" />
            <span>{s.name}</span>
          </div>
        );
      })}
      {rest > 0 && <div className="mm2-pill">+{rest}</div>}
    </div>
  );
}
