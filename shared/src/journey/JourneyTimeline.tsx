// Таймлайн «Моего пути»: группы по месяцам, слева вертикальная линия с
// цветными бейджами-эмодзи по группе занятия. Каждая строка — кнопка
// «поделиться этим шагом» (карточка journeyItemCard). Единственная копия
// для обоих фронтендов (правило №3).
import {
  type JourneyItem,
  type JourneyMonthGroup,
  JOURNEY_GROUP_COLORS,
  formatJourneyDay,
  journeyTypeMeta,
} from './journeyMeta';
import { ShareIcon } from '../share/ShareIcon';

export interface JourneyTimelineProps {
  groups: JourneyMonthGroup[];
  subtitle: (item: JourneyItem) => string | null;
  onShareItem: (item: JourneyItem) => void;
}

const BADGE = 36;

export function JourneyTimeline({
  groups,
  subtitle,
  onShareItem,
}: JourneyTimelineProps) {
  return (
    <div>
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              margin: '0 0 8px 2px',
            }}
          >
            {g.label}
          </div>
          <div style={{ position: 'relative' }}>
            {/* Вертикальная линия таймлайна за бейджами */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: BADGE / 2 + 7,
                top: 10,
                bottom: 10,
                width: 2,
                borderRadius: 1,
                background: 'rgba(var(--fg-rgb),0.06)',
              }}
            />
            {g.items.map((item, i) => {
              const meta = journeyTypeMeta(item.type);
              const color = JOURNEY_GROUP_COLORS[meta.group];
              const sub = subtitle(item);
              return (
                <button
                  key={`${item.type}-${item.at}-${i}`}
                  onClick={() => onShareItem(item)}
                  aria-label={`Поделиться: ${meta.label}`}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    minHeight: 52,
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: 14,
                    background: 'transparent',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: BADGE,
                      height: BADGE,
                      borderRadius: '50%',
                      flexShrink: 0,
                      fontSize: 16,
                      background: `color-mix(in srgb, ${color.css} 16%, var(--bg))`,
                      border: `1px solid color-mix(in srgb, ${color.css} 26%, transparent)`,
                    }}
                  >
                    {meta.emoji}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                        lineHeight: 1.3,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        color: 'var(--text-faint)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {formatJourneyDay(item.at)}
                      {sub ? ` · ${sub}` : ''}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      color: 'var(--text-faint)',
                      opacity: 0.6,
                      flexShrink: 0,
                      display: 'flex',
                    }}
                  >
                    <ShareIcon size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
