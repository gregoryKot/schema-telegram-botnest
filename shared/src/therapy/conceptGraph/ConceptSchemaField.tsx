import { useState } from 'react';
import { ConceptSchemaPicker } from './ConceptSchemaPicker';
import { hintStyle, labelStyle } from './graphStyles';

/**
 * «Какие схемы включают режим»: чипы схем концептуализации + переключатель
 * «Все схемы». Схема, которой в концептуализации нет, добавляется и туда
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
    <div role="group" aria-label="Какие схемы включают режим">
      <div style={{ ...labelStyle, marginBottom: 6 }}>
        Какие схемы включают режим
      </div>
      {noneAtOpen && (
        <div style={{ ...hintStyle, marginBottom: 6 }}>
          Схемы в концептуализации ещё не отмечены — выбранная здесь добавится и
          туда.
        </div>
      )}
      <ConceptSchemaPicker
        activeIds={linkSchemaIds}
        onToggle={toggle}
        onlyIds={showAll ? undefined : visible}
        domainTitles={showAll}
      />
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
