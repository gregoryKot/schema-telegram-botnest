import { SectionLabel } from '../SectionLabel';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { NeedId, NeedMetaEntry, SCHEMA_HINTS } from './data';

export function SchemaHintsSection({
  needMeta,
  ratings,
  lowNeeds,
  onOpenSchemasClick,
  onSelectSchema,
}: {
  needMeta: Record<NeedId, NeedMetaEntry>;
  ratings: Record<NeedId, number>;
  lowNeeds: NeedId[];
  onOpenSchemasClick: () => void;
  onSelectSchema: (schema: {
    name: string;
    desc: string;
    color: string;
  }) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel>Возможные активные схемы</SectionLabel>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-sub)',
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        Когда потребность хронически не удовлетворялась в детстве, психика
        вырабатывает стратегии выживания. Это и есть схемы — не диагноз, а
        паттерн, который когда-то помогал.
      </div>
      {lowNeeds.map((id) => {
        const meta = needMeta[id];
        const hint = SCHEMA_HINTS[id];
        return (
          <div
            key={id}
            style={{
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>{meta.emoji}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: hint.color,
                  marginLeft: 'auto',
                }}
              >
                {ratings[id]}/10 в детстве
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginBottom: 6,
              }}
            >
              Домен: {hint.domain}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {hint.schemas.map((s) => {
                const schemaData = SCHEMA_DOMAINS.flatMap((d) =>
                  d.schemas.map((sc) => ({ ...sc, color: d.color })),
                ).find((sc) => sc.name === s);
                return (
                  <span
                    key={s}
                    onClick={() => schemaData && onSelectSchema(schemaData)}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: hint.color + '18',
                      color: hint.color,
                      cursor: schemaData ? 'pointer' : 'default',
                      textDecoration: schemaData ? 'underline dotted' : 'none',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {s}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      <div
        onClick={onOpenSchemasClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          borderRadius: 14,
          padding: '12px 16px',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--accent)',
            }}
          >
            Подробнее о схемах
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              marginTop: 2,
            }}
          >
            Что они значат и как с ними работать
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--accent)' }}>›</span>
      </div>
    </div>
  );
}
