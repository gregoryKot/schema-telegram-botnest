import { COLORS } from '../../types';
import { TherapyNote } from '../TherapyNote';
import { NEED_IDS, NeedId, NeedMetaEntry } from './data';
import { ChildhoodWheel } from './ChildhoodWheel';
import { SchemaHintsSection } from './SchemaHintsSection';

export function ResultPhase({
  tr,
  needMeta,
  ratings,
  lowNeeds,
  onEdit,
  onFinish,
  onOpenSchemasClick,
  onSelectSchema,
}: {
  tr: (ty: string, vy: string) => string;
  needMeta: Record<NeedId, NeedMetaEntry>;
  ratings: Record<NeedId, number>;
  lowNeeds: NeedId[];
  onEdit: () => void;
  onFinish: () => void;
  onOpenSchemasClick: () => void;
  onSelectSchema: (schema: {
    name: string;
    desc: string;
    color: string;
  }) => void;
}) {
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
              <span style={{ fontSize: 13 }}>{needMeta[id].emoji}</span>
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                {needMeta[id].label.split(' ')[0]}
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
        <SchemaHintsSection
          needMeta={needMeta}
          ratings={ratings}
          lowNeeds={lowNeeds}
          onOpenSchemasClick={onOpenSchemasClick}
          onSelectSchema={onSelectSchema}
        />
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
          onClick={onFinish}
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
