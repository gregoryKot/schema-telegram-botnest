import { useNeedData } from '../../needData';
import { pressable } from '../../utils/a11y';
import { NEED_IDS, needScoreColor } from './utils';

interface NeedsTabProps {
  childhoodRatings: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenNeedDetail: (id: string) => void;
}

export function NeedsTab({
  childhoodRatings,
  onOpenChildhoodWheel,
  onOpenNeedDetail,
}: NeedsTabProps) {
  const NEED_DATA = useNeedData();
  const hasChildhood = Object.keys(childhoodRatings).length > 0;

  return (
    <>
      {!hasChildhood && (
        <div
          {...pressable(() => onOpenChildhoodWheel?.())}
          style={{
            background: 'color-mix(in srgb, var(--accent) 7%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
            borderRadius: 18,
            padding: '14px 16px',
            cursor: 'pointer',
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
              Колесо детства
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              Как потребности удовлетворялись в детстве?
            </div>
          </div>
          <span
            style={{
              fontSize: 20,
              color: 'var(--accent)',
              fontWeight: 300,
            }}
          >
            ›
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {NEED_IDS.map(({ id, color }) => {
          const d = NEED_DATA[id];
          if (!d) return null;
          const childScore = childhoodRatings[id];
          return (
            <div
              key={id}
              {...pressable(() => onOpenNeedDetail(id))}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${color}22`,
                borderRadius: 18,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  flexShrink: 0,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                {d.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-sub)',
                    marginTop: 3,
                  }}
                >
                  {d.hint}
                </div>
              </div>
              {childScore !== undefined ? (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: needScoreColor(childScore),
                      lineHeight: 1,
                    }}
                  >
                    {childScore}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--text-faint)',
                      letterSpacing: '0.04em',
                      marginTop: 2,
                    }}
                  >
                    детство
                  </div>
                </div>
              ) : (
                <span
                  style={{
                    color: 'var(--text-faint)',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  ›
                </span>
              )}
            </div>
          );
        })}
      </div>

      {hasChildhood && (
        <div
          {...pressable(() => onOpenChildhoodWheel?.())}
          style={{
            textAlign: 'center',
            paddingTop: 4,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Изменить ответы →
          </span>
        </div>
      )}
    </>
  );
}
