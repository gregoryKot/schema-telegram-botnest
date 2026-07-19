import { useTr } from '../../utils/addressForm';
import { COLORS } from '../../types';
import { SectionLabel } from '../SectionLabel';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { TherapyNote } from '../TherapyNote';
import { pressable } from '../../utils/a11y';
import { ChildhoodWheel } from './ChildhoodWheel';
import { SCHEMA_HINTS } from './schemaHints';
import {
  NEED_IDS,
  type ActiveSchema,
  type NeedId,
  type NeedMetaEntry,
  type Ratings,
} from './types';

export function ResultPhase({
  NEED_META,
  ratings,
  onEdit,
  onDone,
  onOpenSchemas,
  setActiveSchema,
}: {
  NEED_META: Record<NeedId, NeedMetaEntry>;
  ratings: Ratings;
  onEdit: () => void;
  onDone: () => void;
  onOpenSchemas: () => void;
  setActiveSchema: (s: ActiveSchema) => void;
}) {
  const tr = useTr();
  const lowNeeds = NEED_IDS.filter((id) => ratings[id] <= 4);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 4 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          {tr('Твоё колесо детства', 'Ваше колесо детства')}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          Сравнение отобразится в разделе История поверх дневника
        </div>
      </div>

      {/* Wheel */}
      <div style={{ marginBottom: 20 }}>
        <ChildhoodWheel ratings={ratings} />
      </div>

      {/* Compact score legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        {NEED_IDS.map((id) => {
          const value = ratings[id];
          const color = COLORS[id] ?? '#888';
          return (
            <div
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ fontSize: 13 }}>{NEED_META[id].emoji}</span>
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                {NEED_META[id].label.split(' ')[0]}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    value <= 4
                      ? 'var(--accent-red)'
                      : value <= 6
                        ? 'var(--accent-yellow)'
                        : color,
                }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Schema hints for low needs */}
      {lowNeeds.length > 0 && (
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
            const meta = NEED_META[id];
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
                        {...pressable(() => {
                          if (schemaData) setActiveSchema(schemaData);
                        })}
                        style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: hint.color + '18',
                          color: hint.color,
                          cursor: schemaData ? 'pointer' : 'default',
                          textDecoration: schemaData
                            ? 'underline dotted'
                            : 'none',
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
            {...pressable(() => {
              onDone();
              onOpenSchemas();
            })}
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
      )}

      {lowNeeds.length === 0 && (
        <div
          style={{
            background:
              'color-mix(in srgb, var(--accent-green) 10%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: 'var(--accent-green)',
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Хорошее детство по всем зонам
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            Все потребности выше 4/10 — это редкость и ресурс. Если сейчас
            что-то низкое, скорее всего это ситуативное, а не схема.
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <TherapyNote compact />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            background: 'transparent',
            color: 'var(--text-sub)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ✎ Изменить
        </button>
        <button
          onClick={onDone}
          style={{
            flex: 2,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'rgba(var(--fg-rgb),0.7)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
