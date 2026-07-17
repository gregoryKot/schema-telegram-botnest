import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useTr } from '../../utils/addressForm';
import { InsightsData } from './types';
import { NEED_NAMES } from './constants';

interface Props {
  insights: InsightsData;
}

export function InsightsCard({ insights }: Props) {
  const tr = useTr();
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);

  return (
    <>
      <div
        className="card"
        style={{ borderRadius: 20, padding: '16px 16px 18px' }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 14,
          }}
        >
          Паттерны
        </div>

        {/* Best / worst day pills */}
        {(insights?.bestDayOfWeek || insights?.worstDayOfWeek) &&
          (insights?.totalDays ?? 0) >= 7 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {insights?.bestDayOfWeek && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 10,
                    background:
                      'color-mix(in srgb, var(--accent-yellow) 12%, transparent)',
                    border:
                      '1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)',
                  }}
                >
                  <span style={{ fontSize: 13 }}>☀️</span>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        marginBottom: 1,
                      }}
                    >
                      лучший день
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--accent-yellow)',
                      }}
                    >
                      {insights.bestDayOfWeek}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBestDayInfo(true);
                    }}
                    aria-label="Что такое лучший день"
                    style={{
                      width: 40,
                      height: 40,
                      margin: '-13px -13px -13px -11px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'rgba(var(--fg-rgb),0.08)',
                        color: 'var(--text-sub)',
                        fontSize: 9,
                        fontWeight: 600,
                      }}
                    >
                      ?
                    </span>
                  </button>
                </div>
              )}
              {insights?.worstDayOfWeek && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 10,
                    background:
                      'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                    border:
                      '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
                  }}
                >
                  <span style={{ fontSize: 13 }}>🌧</span>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        marginBottom: 1,
                      }}
                    >
                      тяжелее
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--accent-red)',
                      }}
                    >
                      {insights.worstDayOfWeek}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Need bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights?.weeklyStats
            .filter((s) => s.avg !== null)
            .map((s) => {
              const isUp = s.trend === '↑';
              const isDown = s.trend === '↓';
              const barColor = isUp
                ? 'var(--accent-green)'
                : isDown
                  ? 'var(--accent-red)'
                  : 'var(--accent)';
              const barW = Math.round(((s.avg ?? 0) / 10) * 100);
              return (
                <div key={s.needId}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      {NEED_NAMES[s.needId]}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: barColor,
                      }}
                    >
                      {(s.avg ?? 0).toFixed(1)}{' '}
                      <span style={{ fontSize: 11 }}>{s.trend}</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 4,
                      background: 'rgba(var(--fg-rgb),0.07)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 4,
                        width: `${barW}%`,
                        background: barColor,
                        opacity: 0.7,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Best day tooltip */}
      {showBestDayInfo && (
        <BottomSheet onClose={() => setShowBestDayInfo(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              Лучший день
            </div>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(var(--fg-rgb),0.8)',
                lineHeight: 1.7,
                marginBottom: 14,
              }}
            >
              {tr(
                'День недели, в который твои оценки в среднем выше всего.',
                'День недели, в который ваши оценки в среднем выше всего.',
              )}
            </p>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(var(--fg-rgb),0.8)',
                lineHeight: 1.7,
              }}
            >
              Становится точнее с каждой неделей.
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
