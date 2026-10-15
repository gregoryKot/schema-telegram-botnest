import { useState } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { hintStyle, labelStyle } from './graphStyles';

/**
 * «Какие схемы питают режим»: чипы схем концептуализации + переключатель «Все
 * схемы». Схема, которой в концептуализации нет, добавляется и туда
 * (onAddSchema) — связь не должна ссылаться на схему, которой нет в плане.
 */
export function ConceptSchemaField({
  linkSchemaIds,
  conceptSchemaIds,
  onChange,
  onAddSchema,
}: {
  linkSchemaIds: string[];
  conceptSchemaIds: string[];
  onChange: (schemaIds: string[]) => void;
  onAddSchema: (schemaId: string) => void;
}) {
  // Решение «схем в концептуализации нет» принимается при открытии поля: после
  // первого выбора схема попадает в концептуализацию, и список не должен
  // схлопываться под рукой.
  const [noneAtOpen] = useState(conceptSchemaIds.length === 0);
  const [showAll, setShowAll] = useState(noneAtOpen);
  // Схема из связи, убранная из концептуализации, остаётся видимой — иначе её
  // нельзя было бы снять.
  const visible = new Set([...conceptSchemaIds, ...linkSchemaIds]);

  const toggle = (id: string) => {
    if (linkSchemaIds.includes(id)) {
      onChange(linkSchemaIds.filter((x) => x !== id));
      return;
    }
    if (!conceptSchemaIds.includes(id)) onAddSchema(id);
    onChange([...linkSchemaIds, id]);
  };

  return (
    <div role="group" aria-label="Какие схемы питают режим">
      <div style={{ ...labelStyle, marginBottom: 6 }}>
        Какие схемы питают режим
      </div>
      {noneAtOpen && (
        <div style={{ ...hintStyle, marginBottom: 6 }}>
          Схемы в концептуализации ещё не отмечены — выбранная здесь добавится и
          туда.
        </div>
      )}
      {SCHEMA_DOMAINS.map((domain) => {
        const schemas = domain.schemas.filter(
          (s) => showAll || visible.has(s.id),
        );
        if (schemas.length === 0) return null;
        return (
          <div key={domain.id} style={{ marginBottom: 'var(--space-6)' }}>
            {showAll && (
              <div style={{ ...hintStyle, marginBottom: 4 }}>
                {domain.domain}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-6)',
              }}
            >
              {schemas.map((s) => (
                <ConceptToggleChip
                  key={s.id}
                  label={s.name}
                  color={domain.color}
                  active={linkSchemaIds.includes(s.id)}
                  onClick={() => toggle(s.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        aria-pressed={showAll}
        onClick={() => setShowAll((v) => !v)}
        style={{
          minHeight: 44,
          padding: '0 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Все схемы
      </button>
    </div>
  );
}
