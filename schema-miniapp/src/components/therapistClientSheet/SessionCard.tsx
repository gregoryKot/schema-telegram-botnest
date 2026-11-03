import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { isVirtualId } from '../../../../shared/src/utils/sameId';
import { fmtDate, momentDayKey, todayStr } from '../../utils/format';
import { DAY_NAMES, calcTherapyDuration, nextSessionLabel } from './helpers';
import { isActiveToday } from '../../../../shared/src/therapy/clientSheetHelpers';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { SessionDateTimeFields } from '../../../../shared/src/therapy/SessionDateTimeFields';
import {
  sessionInputHint,
  sessionToSave,
  startDateHint,
} from '../../../../shared/src/therapy/sessionInput';
import { INLINE_FIELD_STYLE, InlineEditRow } from './InlineEditRow';
import { ClientDetail } from './types';
interface SessionCardProps {
  selectedClient: TherapyClientSummary;
  today: string;
  detail: ClientDetail;
  startDateInputRef: React.RefObject<HTMLInputElement | null>;
  nextSessionInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SessionCard({
  selectedClient,
  today,
  detail,
  startDateInputRef,
  nextSessionInputRef,
}: SessionCardProps) {
  const {
    editingDays,
    setEditingDays,
    localMeetingDays,
    setLocalMeetingDays,
    editingStartDate,
    setEditingStartDate,
    localStartDate,
    setLocalStartDate,
    editingNextSession,
    setEditingNextSession,
    localNextSession,
    setLocalNextSession,
    sessionInfoSaving,
    sessionInfoError,
    saveSessionInfo,
  } = detail;

  const effectiveStart =
    selectedClient.therapyStartDate ?? selectedClient.relationCreatedAt;
  const duration = effectiveStart ? calcTherapyDuration(effectiveStart) : null;
  const upcoming = upcomingSession(
    selectedClient.nextSession,
    selectedClient.meetingDays,
    today,
  );
  const activeToday = isActiveToday(selectedClient);
  const startHint = editingStartDate ? startDateHint(localStartDate) : null;
  const sessionHint = editingNextSession
    ? sessionInputHint(localNextSession)
    : null;
  const hint = startHint ?? sessionHint;
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
      <div className="u-between-mb10">
        <div>
          {editingStartDate ? (
            <InlineEditRow
              onSave={async () => {
                await saveSessionInfo({
                  therapyStartDate: localStartDate || null,
                });
                setEditingStartDate(false);
              }}
              onCancel={() => setEditingStartDate(false)}
              saveDisabled={sessionInfoSaving || startHint !== null}
            >
              <input
                type="date"
                max={todayStr()}
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                ref={startDateInputRef}
                style={INLINE_FIELD_STYLE}
              />
            </InlineEditRow>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              {...pressable(() => {
                setLocalStartDate(
                  selectedClient.therapyStartDate ??
                    (selectedClient.relationCreatedAt
                      ? momentDayKey(selectedClient.relationCreatedAt)
                      : ''),
                );
                setEditingStartDate(true);
              })}
            >
              <span className="u-sub13">
                {effectiveStart
                  ? `С ${fmtDate(momentDayKey(effectiveStart))}`
                  : 'Начало не указано'}
              </span>
              {duration && <span className="u-sub12">· {duration}</span>}
              <span className="u-faint11">✎</span>
            </div>
          )}
        </div>
        {/* Activity badge */}
        {!isVirtualId(selectedClient.telegramId) &&
          selectedClient.lastActiveDate && (
            <span
              style={{
                fontSize: 11,
                color: activeToday ? '#06d6a0' : 'rgba(var(--fg-rgb),0.3)',
                background: activeToday
                  ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                  : 'rgba(var(--fg-rgb),0.05)',
                padding: '3px 8px',
                borderRadius: 'var(--r-20)',
              }}
            >
              {activeToday
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
          gap: 'var(--space-8)',
          flexWrap: 'wrap',
        }}
      >
        {/* Days */}
        {editingDays ? (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
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
                  borderRadius: 'var(--r-20)',
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
                borderRadius: 'var(--r-20)',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
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
                borderRadius: 'var(--r-20)',
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
              gap: 'var(--space-4)',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            {...pressable(() => {
              setLocalMeetingDays(selectedClient.meetingDays ?? []);
              setEditingDays(true);
            })}
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
                        borderRadius: 'var(--r-20)',
                        background:
                          'color-mix(in srgb, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                      }}
                    >
                      {DAY_NAMES[d]}
                    </span>
                  ))}
                <span className="u-faint11">✎</span>
              </>
            )}
          </div>
        )}

        {/* Next session */}
        {!editingDays &&
          (editingNextSession ? (
            <InlineEditRow
              onSave={async () => {
                await saveSessionInfo({
                  nextSession: sessionToSave(localNextSession),
                });
                setEditingNextSession(false);
              }}
              onCancel={() => setEditingNextSession(false)}
              saveDisabled={sessionInfoSaving || sessionHint !== null}
              style={{ marginLeft: 'auto' }}
            >
              <SessionDateTimeFields
                value={localNextSession}
                onChange={setLocalNextSession}
                dateRef={nextSessionInputRef}
                style={INLINE_FIELD_STYLE}
              />
            </InlineEditRow>
          ) : (
            <div
              style={{
                marginLeft: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
              {...pressable(() => {
                setLocalNextSession(upcoming ?? '');
                setEditingNextSession(true);
              })}
            >
              {upcoming ? (
                <>
                  <span className="u-sub11-mt1">след.</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(var(--fg-rgb),0.7)',
                    }}
                  >
                    {nextSessionLabel(upcoming)}
                  </span>
                  <span className="u-faint11">✎</span>
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
      {(hint ?? sessionInfoError) && (
        <div
          role="alert"
          style={{
            fontSize: 11,
            color: 'var(--accent-red)',
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {hint ?? sessionInfoError}
        </div>
      )}
    </div>
  );
}
