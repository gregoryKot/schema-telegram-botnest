import type { UserSettings } from '../../api';
import { TIMEZONES, HOURS, FREQ_LABELS, QUIET_PRESETS, pad } from '../../../../shared/src/settings/constants';

export type SubView = 'main' | 'time' | 'tz' | 'freq' | 'quiet';

interface Props {
  subView: Exclude<SubView, 'main'>;
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  onDone: () => void;
}

// Подэкраны выбора (время, частота, тихие часы, пояс): тап по варианту
// сохраняет его и возвращает на главный экран настроек.
export function SettingsSubView({ subView, settings, patch, onDone }: Props) {
  const choose = (update: Partial<UserSettings>) => async () => { await patch(update); onDone(); };
  const keys = (fn: () => Promise<void>) => async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await fn(); }
  };
  const option = (key: string | number, label: string, active: boolean, update: Partial<UserSettings>) => {
    const fn = choose(update);
    return (
      <div key={key} onClick={fn} role="button" tabIndex={0} onKeyDown={keys(fn)}
        className={`st-opt${active ? ' is-active' : ''}`}
      >{label}{active && <span>✓</span>}</div>
    );
  };

  if (subView === 'time') {
    return (
      <div className="ds-card st-hours">
        {HOURS.map(h => {
          const fn = choose({ notifyLocalHour: h });
          return (
            <div key={h} onClick={fn} role="button" tabIndex={0} onKeyDown={keys(fn)}
              className={`st-hour${h === settings.notifyLocalHour ? ' is-active' : ''}`}
            >{pad(h)}:00</div>
          );
        })}
      </div>
    );
  }
  if (subView === 'freq') {
    return (
      <div className="ds-card">
        <div className="st-text st-mb10">
          Если напоминания будут оставаться без ответа, бот сам начнёт писать реже — а когда записи вернутся, вернётся к выбранной частоте.
        </div>
        <div className="st-opts">
          {FREQ_LABELS.map((label, i) => option(i, label, i === (settings.notifyFrequency ?? 0), { notifyFrequency: i }))}
        </div>
      </div>
    );
  }
  if (subView === 'quiet') {
    return (
      <div className="ds-card">
        <div className="st-text st-mb10">
          В тихие часы бот не пишет вообще — всё, что накопится, придёт утром.
        </div>
        <div className="st-opts">
          {QUIET_PRESETS.map(p => option(
            p.label, p.label,
            p.start === (settings.notifyQuietStart ?? 22) && p.end === (settings.notifyQuietEnd ?? 8),
            { notifyQuietStart: p.start, notifyQuietEnd: p.end },
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="ds-card st-opts">
      {TIMEZONES.map(tz => option(tz.iana, tz.label, tz.iana === settings.notifyTimezone, { notifyTimezone: tz.iana }))}
    </div>
  );
}
