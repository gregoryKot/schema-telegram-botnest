import { useState } from 'react';
import { haptic } from '../../haptic';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

// Выбор схем в дневнике (по доменам) + переключатель «только мои/все».
// Вынесено из SchemaEntrySheet.tsx (правило №10).
//
// Домены свёрнуты: двадцать схем разом — стена терминов, в которой новичку
// не за что зацепиться. Открытым остаётся то, что человек открыл сам, плюс
// домен с уже отмеченной схемой (иначе выбор пропадал бы из виду).
export function SchemaPicker({
  schemaIds,
  onToggle,
  useFiltered,
  activeSchemaIds,
  hasPersonalSchemas,
  showAllSchemas,
  onToggleShowAll,
}: {
  schemaIds: string[];
  onToggle: (id: string) => void;
  useFiltered?: boolean;
  activeSchemaIds?: string[];
  hasPersonalSchemas?: boolean;
  showAllSchemas: boolean;
  onToggleShowAll: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {SCHEMA_DOMAINS.map((domain) => {
        const schemas = useFiltered
          ? domain.schemas.filter(
              (s) => activeSchemaIds?.includes(s.id) ?? false,
            )
          : domain.schemas;
        if (schemas.length === 0) return null;
        const picked = schemas.filter((s) => schemaIds.includes(s.id));
        const open = openId === domain.id || picked.length > 0;
        return (
          <div key={domain.id} style={{ marginBottom: 6 }}>
            <button
              onClick={() => {
                haptic.tap();
                setOpenId(open && openId === domain.id ? null : domain.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                minHeight: 48,
                padding: '12px 2px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span className="d-caps" style={{ flex: 1 }}>
                {domain.domain}
              </span>
              {picked.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                  {picked.length}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--chevron)' }}>
                {open ? '▲' : '▼'}
              </span>
            </button>
            {open && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '12px 0 6px',
                }}
              >
                {schemas.map((s) => {
                  const sel = schemaIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onToggle(s.id)}
                      className="sel-btn"
                      style={{
                        background: sel ? 'var(--accent-bg)' : 'var(--surface)',
                        border: sel
                          ? '1px solid var(--accent)'
                          : '1px solid rgba(34,30,27,0.1)',
                        borderRadius: 999,
                        padding: '10px 14px',
                        minHeight: 44,
                        color: sel ? 'var(--accent)' : 'var(--ink-2)',
                        fontSize: 13,
                        fontWeight: sel ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {hasPersonalSchemas && (
        <button
          onClick={onToggleShowAll}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '14px 2px',
            minHeight: 48,
          }}
        >
          {showAllSchemas ? '↑ Только мои' : '↓ Показать все'}
        </button>
      )}
    </>
  );
}
