// Экраны-подвиды уведомлений SettingsSheet (время/частота/тихие часы/пояс).
// Вынесено из SettingsSheet.tsx.
import type { UserSettings } from '../../api';
import {
  TIMEZONES,
  HOURS,
  FREQ_LABELS,
  QUIET_PRESETS,
  pad,
  type View,
} from './constants';

export function NotifySubViews({
  view,
  settings,
  localHour,
  patch,
  setView,
}: {
  view: View;
  settings: UserSettings;
  localHour: number;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  setView: (v: View) => void;
}) {
  return (
    <>
      {view === 'time' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {HOURS.map((h) => {
            const active = h === localHour;
            return (
              <div
                key={h}
                onClick={async () => {
                  await patch({ notifyLocalHour: h });
                  setView('main');
                }}
                role="button"
                tabIndex={0}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    await patch({ notifyLocalHour: h });
                    setView('main');
                  }
                }}
                style={{
                  padding: '12px 0',
                  borderRadius: 12,
                  textAlign: 'center',
                  background: active
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.06)',
                  color: active ? '#fff' : 'rgba(var(--fg-rgb),0.6)',
                  fontSize: 15,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {pad(h)}:00
              </div>
            );
          })}
        </div>
      )}

      {/* ── FREQ VIEW ── */}
      {view === 'freq' && (
        <>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
              marginBottom: 12,
              padding: '0 4px',
            }}
          >
            Если напоминания будут оставаться без ответа, бот сам начнёт писать
            реже — а когда записи вернутся, вернётся к выбранной частоте.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FREQ_LABELS.map((label, i) => {
              const active = i === (settings.notifyFrequency ?? 0);
              return (
                <div
                  key={i}
                  onClick={async () => {
                    await patch({ notifyFrequency: i });
                    setView('main');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      await patch({ notifyFrequency: i });
                      setView('main');
                    }
                  }}
                  style={{
                    padding: '13px 16px',
                    borderRadius: 12,
                    background: active
                      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'rgba(var(--fg-rgb),0.04)',
                    color: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.7)',
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  {label}
                  {active && <span>✓</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── QUIET VIEW ── */}
      {view === 'quiet' && (
        <>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
              marginBottom: 12,
              padding: '0 4px',
            }}
          >
            В тихие часы бот не пишет вообще — всё, что накопится, придёт утром.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {QUIET_PRESETS.map((p) => {
              const active =
                p.start === (settings.notifyQuietStart ?? 22) &&
                p.end === (settings.notifyQuietEnd ?? 8);
              return (
                <div
                  key={p.label}
                  onClick={async () => {
                    await patch({
                      notifyQuietStart: p.start,
                      notifyQuietEnd: p.end,
                    });
                    setView('main');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      await patch({
                        notifyQuietStart: p.start,
                        notifyQuietEnd: p.end,
                      });
                      setView('main');
                    }
                  }}
                  style={{
                    padding: '13px 16px',
                    borderRadius: 12,
                    background: active
                      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'rgba(var(--fg-rgb),0.04)',
                    color: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.7)',
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  {p.label}
                  {active && <span>✓</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TZ VIEW ── */}
      {view === 'tz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TIMEZONES.map((tz) => {
            const active = tz.iana === settings.notifyTimezone;
            return (
              <div
                key={tz.iana}
                onClick={async () => {
                  await patch({ notifyTimezone: tz.iana });
                  setView('main');
                }}
                role="button"
                tabIndex={0}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    await patch({ notifyTimezone: tz.iana });
                    setView('main');
                  }
                }}
                style={{
                  padding: '13px 16px',
                  borderRadius: 12,
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                    : 'rgba(var(--fg-rgb),0.04)',
                  color: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.7)',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                {tz.label}
                {active && <span>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
