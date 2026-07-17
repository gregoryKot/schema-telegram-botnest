import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import type { ClientDetail } from './types';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function YsqPanel({ selectedClient, detail }: Props) {
  const { handleRequestYsq, ysqRequested, ysqError, clientData } = detail;

  return (
    <>
      {selectedClient.telegramId > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleRequestYsq}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(96,165,250,0.2)',
              background: 'rgba(96,165,250,0.06)',
              color: ysqRequested ? '#06d6a0' : 'rgba(96,165,250,0.8)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {ysqRequested ? '✓ Запрос отправлен' : '📋 Запросить тест на схемы'}
          </button>
          {ysqError && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--accent-red)',
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              {ysqError}
            </div>
          )}
        </div>
      )}
      {(clientData?.ysqHistory?.length ?? 0) > 0 &&
        (() => {
          const hist = clientData!.ysqHistory;
          const latest = hist[0];
          const prev = hist[1] ?? null;
          const activeScores = latest.scores
            .filter((s) => s.pct5plus > 50)
            .sort((a, b) => b.pct5plus - a.pct5plus);
          const inactiveScores = latest.scores
            .filter((s) => s.pct5plus <= 50)
            .sort((a, b) => b.pct5plus - a.pct5plus);
          const latestDate = new Date(latest.completedAt).toLocaleDateString(
            'ru-RU',
            {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            },
          );
          const getDelta = (id: string) => {
            if (!prev) return null;
            const p = prev.scores.find((s) => s.id === id);
            if (p == null) return null;
            const d =
              (latest.scores.find((s) => s.id === id)?.pct5plus ?? 0) -
              p.pct5plus;
            return Math.abs(d) >= 5 ? d : null;
          };
          return (
            <div
              style={{
                background: 'rgba(79,163,247,0.07)',
                border: '1px solid rgba(79,163,247,0.2)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'rgba(79,163,247,0.8)',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                📊 Схемы · {hist.length}{' '}
                {hist.length === 1
                  ? 'прохождение'
                  : hist.length < 5
                    ? 'прохождения'
                    : 'прохождений'}{' '}
                · {latestDate}
              </div>

              {/* Active schemas */}
              {activeScores.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(79,163,247,0.7)',
                      marginBottom: 6,
                    }}
                  >
                    Выраженные ({activeScores.length})
                  </div>
                  {activeScores.map((score) => {
                    const meta = SCHEMA_DOMAINS.flatMap((d) => d.schemas).find(
                      (s) => s.id === score.id,
                    );
                    const delta = getDelta(score.id);
                    return (
                      <div key={score.id} style={{ marginBottom: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--text)',
                              fontWeight: 500,
                            }}
                          >
                            {meta?.emoji} {meta?.name ?? score.id}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              gap: 5,
                              alignItems: 'center',
                            }}
                          >
                            {delta !== null && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color:
                                    delta < 0
                                      ? 'var(--accent-green)'
                                      : 'var(--accent-red)',
                                }}
                              >
                                {delta > 0 ? '+' : ''}
                                {delta}%
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'rgba(79,163,247,0.9)',
                              }}
                            >
                              {score.pct5plus}%
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            height: 3,
                            background: 'rgba(79,163,247,0.1)',
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${score.pct5plus}%`,
                              background: 'rgba(79,163,247,0.6)',
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inactive schemas — compact */}
              {inactiveScores.length > 0 && (
                <div style={{ marginBottom: hist.length >= 2 ? 10 : 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-faint)',
                      marginBottom: 6,
                    }}
                  >
                    Остальные
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {inactiveScores.map((score) => {
                      const meta = SCHEMA_DOMAINS.flatMap(
                        (d) => d.schemas,
                      ).find((s) => s.id === score.id);
                      const isNearBorder = score.pct5plus >= 30;
                      return (
                        <span
                          key={score.id}
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 12,
                            background: 'rgba(var(--fg-rgb),0.05)',
                            color: isNearBorder
                              ? 'var(--text-sub)'
                              : 'var(--text-faint)',
                          }}
                        >
                          {meta?.name ?? score.id} {score.pct5plus}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* History timeline */}
              {hist.length >= 2 && (
                <div
                  style={{
                    borderTop: '1px solid rgba(79,163,247,0.15)',
                    paddingTop: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(79,163,247,0.6)',
                      marginBottom: 6,
                    }}
                  >
                    История
                  </div>
                  {hist.map((entry, idx) => {
                    const entryActive = entry.scores.filter(
                      (s) => s.pct5plus > 50,
                    ).length;
                    const prevItem = hist[idx + 1];
                    const entryDelta = prevItem
                      ? entryActive -
                        prevItem.scores.filter((s) => s.pct5plus > 50).length
                      : null;
                    const d = new Date(entry.completedAt).toLocaleDateString(
                      'ru-RU',
                      {
                        day: 'numeric',
                        month: 'short',
                      },
                    );
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background:
                              idx === 0
                                ? 'rgba(79,163,247,0.8)'
                                : 'rgba(79,163,247,0.25)',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              idx === 0
                                ? 'var(--text-sub)'
                                : 'var(--text-faint)',
                            flex: 1,
                          }}
                        >
                          {entryActive} схем {idx === 0 ? '· сейчас' : ''}
                        </span>
                        {entryDelta !== null && entryDelta !== 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color:
                                entryDelta < 0
                                  ? 'var(--accent-green)'
                                  : 'var(--accent-red)',
                            }}
                          >
                            {entryDelta > 0 ? '+' : ''}
                            {entryDelta}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-faint)',
                          }}
                        >
                          {d}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
    </>
  );
}
