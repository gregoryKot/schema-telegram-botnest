import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { calcTherapyDuration, nextSessionLabel, DAY_NAMES } from './helpers';
import type { ClientDetail } from './types';

interface Props {
  selectedClient: TherapyClientSummary;
  today: string;
  detail: ClientDetail;
}

export function SessionCard({ selectedClient, today, detail }: Props) {
  const {
    editingDays,
    localMeetingDays,
    setLocalMeetingDays,
    setEditingDays,
    editingStartDate,
    localStartDate,
    setLocalStartDate,
    setEditingStartDate,
    saveSessionInfo,
    sessionInfoSaving,
    sessionInfoError,
    editingNextSession,
    localNextSession,
    setLocalNextSession,
    setEditingNextSession,
  } = detail;

  const effectiveStart =
    selectedClient.therapyStartDate ?? selectedClient.relationCreatedAt;
  const duration = effectiveStart ? calcTherapyDuration(effectiveStart) : null;
  const displayDays = editingDays
    ? localMeetingDays
    : (selectedClient.meetingDays ?? []);
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        border: '1px solid rgba(var(--fg-rgb),0.08)',
        borderRadius: 18,
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      {/* Row 1: Start date + duration */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div>
          {editingStartDate ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <input
                type="date"
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                autoFocus
                style={{
                  background: 'rgba(var(--fg-rgb),0.07)',
                  border: '1px solid rgba(var(--fg-rgb),0.15)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
              <button
                onClick={async () => {
                  await saveSessionInfo({
                    therapyStartDate: localStartDate || null,
                  });
                  setEditingStartDate(false);
                }}
                disabled={sessionInfoSaving}
                aria-label="Сохранить"
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✓
              </button>
              <button
                onClick={() => setEditingStartDate(false)}
                aria-label="Отменить"
                style={{
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(var(--fg-rgb),0.08)',
                  color: 'var(--text-sub)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              onClick={() => {
                setLocalStartDate(
                  selectedClient.therapyStartDate ??
                    selectedClient.relationCreatedAt?.slice(0, 10) ??
                    '',
                );
                setEditingStartDate(true);
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {effectiveStart
                  ? `С ${fmtDate(effectiveStart.slice(0, 10))}`
                  : 'Начало не указано'}
              </span>
              {duration && (
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  · {duration}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                ✎
              </span>
            </div>
          )}
        </div>
        {/* Activity badge */}
        {selectedClient.telegramId > 0 && selectedClient.lastActiveDate && (
          <span
            style={{
              fontSize: 11,
              color:
                selectedClient.lastActiveDate === today
                  ? '#06d6a0'
                  : 'rgba(var(--fg-rgb),0.3)',
              background:
                selectedClient.lastActiveDate === today
                  ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                  : 'rgba(var(--fg-rgb),0.05)',
              padding: '3px 8px',
              borderRadius: 20,
            }}
          >
            {selectedClient.lastActiveDate === today
              ? '● сегодня'
              : fmtDate(selectedClient.lastActiveDate)}
          </span>
        )}
      </div>

      {/* Row 2: Meeting days + next session */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Days */}
        {editingDays ? (
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                onClick={() =>
                  setLocalMeetingDays((prev) =>
                    prev.includes(d)
                      ? prev.filter((x) => x !== d)
                      : [...prev, d],
                  )
                }
                style={{
                  padding: '4px 9px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: localMeetingDays.includes(d)
                    ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
                    : 'rgba(var(--fg-rgb),0.07)',
                  color: localMeetingDays.includes(d)
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.4)',
                }}
              >
                {DAY_NAMES[d]}
              </button>
            ))}
            <button
              onClick={async () => {
                await saveSessionInfo({
                  meetingDays: localMeetingDays,
                });
                setEditingDays(false);
              }}
              disabled={sessionInfoSaving}
              aria-label="Сохранить"
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✓
            </button>
            <button
              onClick={() => setEditingDays(false)}
              aria-label="Отменить"
              style={{
                padding: '4px 8px',
                borderRadius: 20,
                border: 'none',
                background: 'rgba(var(--fg-rgb),0.07)',
                color: 'var(--text-sub)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => {
              setLocalMeetingDays(selectedClient.meetingDays ?? []);
              setEditingDays(true);
            }}
          >
            {displayDays.length === 0 ? (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  borderBottom: '1px dashed rgba(var(--fg-rgb),0.2)',
                }}
              >
                дни встреч +
              </span>
            ) : (
              <>
                {[1, 2, 3, 4, 5, 6, 0]
                  .filter((d) => displayDays.includes(d))
                  .map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 20,
                        background:
                          'color-mix(in srgb, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                      }}
                    >
                      {DAY_NAMES[d]}
                    </span>
                  ))}
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                  }}
                >
                  ✎
                </span>
              </>
            )}
          </div>
        )}

        {/* Next session */}
        {!editingDays &&
          (editingNextSession ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                marginLeft: 'auto',
              }}
            >
              <input
                type="datetime-local"
                value={localNextSession}
                onChange={(e) => setLocalNextSession(e.target.value)}
                autoFocus
                style={{
                  background: 'rgba(var(--fg-rgb),0.07)',
                  border: '1px solid rgba(var(--fg-rgb),0.15)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
              <button
                onClick={async () => {
                  await saveSessionInfo({
                    nextSession: localNextSession || null,
                  });
                  setEditingNextSession(false);
                }}
                disabled={sessionInfoSaving}
                aria-label="Сохранить"
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✓
              </button>
              <button
                onClick={() => setEditingNextSession(false)}
                aria-label="Отменить"
                style={{
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(var(--fg-rgb),0.08)',
                  color: 'var(--text-sub)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                marginLeft: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => {
                setLocalNextSession(selectedClient.nextSession ?? '');
                setEditingNextSession(true);
              }}
            >
              {selectedClient.nextSession ? (
                <>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                    }}
                  >
                    след.
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(var(--fg-rgb),0.7)',
                    }}
                  >
                    {nextSessionLabel(selectedClient.nextSession)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                    }}
                  >
                    ✎
                  </span>
                </>
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-faint)',
                    borderBottom: '1px dashed rgba(var(--fg-rgb),0.2)',
                  }}
                >
                  следующая +
                </span>
              )}
            </div>
          ))}
      </div>
      {sessionInfoError && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--accent-red)',
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {sessionInfoError}
        </div>
      )}
    </div>
  );
}
