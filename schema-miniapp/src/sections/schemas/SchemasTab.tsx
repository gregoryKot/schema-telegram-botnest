import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate } from '../../utils/format';
import { cm, hex, shortName } from './utils';

interface Props {
  profileLoading: boolean;
  allSchemaIds: string[];
  expandedDomains: Set<string>;
  ysqCompletedAt: string | null;
  onSelectSchema: (id: string) => void;
  onAddSchema: () => void;
  onToggleDomain: (id: string) => void;
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
}

export function SchemasTab({
  profileLoading,
  allSchemaIds,
  expandedDomains,
  ysqCompletedAt,
  onSelectSchema,
  onAddSchema,
  onToggleDomain,
  onOpenSchema,
}: Props) {
  return (
    <>
      {/* МОИ СХЕМЫ */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 10,
          }}
        >
          Мои схемы
        </div>
        {profileLoading ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[80, 100, 90, 110].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  width: w,
                  borderRadius: 20,
                  background:
                    'linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)',
                  backgroundSize: '200% auto',
                  animation: 'shimmer 1.5s linear infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allSchemaIds.map((id) => {
              const domain = SCHEMA_DOMAINS.find((d) =>
                d.schemas.some((s) => s.id === id),
              );
              const schema = domain?.schemas.find((s) => s.id === id);
              if (!schema || !domain) return null;
              const c = domain.color; // CSS variable — use directly
              return (
                <button
                  key={id}
                  onClick={() => onSelectSchema(id)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 20,
                    border: `1.5px solid ${cm(c, 35)}`,
                    background: cm(c, 9),
                    color: c,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {shortName(schema.name)}
                </button>
              );
            })}
            <button
              onClick={onAddSchema}
              style={{
                padding: '6px 13px',
                borderRadius: 20,
                border: '1.5px dashed var(--border-color)',
                background: 'transparent',
                color: 'var(--text-sub)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              + Добавить
            </button>
          </div>
        )}
      </div>

      {/* YSQ card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 18,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: 2,
            }}
          >
            Тест на схемы
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {ysqCompletedAt
              ? `Пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · 116 вопросов`
              : 'Определи схемы автоматически'}
          </div>
        </div>
        <button
          onClick={() => onOpenSchema({ startTest: true })}
          style={{
            padding: '9px 20px',
            borderRadius: 12,
            border: 'none',
            background: ysqCompletedAt
              ? 'rgba(var(--fg-rgb),0.08)'
              : 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            color: ysqCompletedAt ? 'var(--text-sub)' : '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {ysqCompletedAt ? 'Снова' : 'Начать'}
        </button>
      </div>

      {/* ВСЕ СХЕМЫ */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 10,
          }}
        >
          Все схемы
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCHEMA_DOMAINS.map((domain) => {
            const isOpen = expandedDomains.has(domain.id);
            const c = domain.color; // CSS variable
            return (
              <div
                key={domain.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => onToggleDomain(domain.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: hex(c),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {domain.domain}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: 'var(--text-faint)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {domain.schemas.length}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-faint)',
                        fontSize: 14,
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    >
                      ›
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div
                    style={{
                      padding: '0 16px 14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {domain.schemas.map((s) => {
                      const active = allSchemaIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onSelectSchema(s.id)}
                          style={{
                            padding: '6px 13px',
                            borderRadius: 20,
                            border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                            background: cm(c, active ? 11 : 5),
                            color: active ? c : 'var(--text-sub)',
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {shortName(s.name)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
