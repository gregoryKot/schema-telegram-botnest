import type { UserSettings } from '../../api';
import { hueStyle } from '../../lib/tone';
import { HOURS, FREQ_LABELS, QUIET_PRESETS, pad } from '../../../../shared/src/settings/constants';
import { timezoneOptions } from '../../../../shared/src/settings/timezones';

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
  const option = (key: string | number, label: string, active: boolean, update: Partial<UserSettings>) => (
    <button key={key} type="button" aria-pressed={active} onClick={choose(update)}
      className="ds-list-row ds-list-row--nav ds-list-row--inset ds-list-row--hover"
    ><span className="ds-list-title">{label}</span>{active && <span className="st-check" aria-hidden="true">✓</span>}</button>
  );

  if (subView === 'time') {
    return (
      <div className="ds-card st-hours" style={hueStyle(undefined)}>
        {HOURS.map(h => (
          <button key={h} type="button" aria-pressed={h === settings.notifyLocalHour} onClick={choose({ notifyLocalHour: h })}
            className={`ds-chip ds-chip--toggle${h === settings.notifyLocalHour ? ' is-on' : ''}`}
          >{pad(h)}:00</button>
        ))}
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
          {QUIET_PRESETS.map(p => option(p.label, p.label,
            p.start === (settings.notifyQuietStart ?? 22) && p.end === (settings.notifyQuietEnd ?? 8),
            { notifyQuietStart: p.start, notifyQuietEnd: p.end }))}
        </div>
      </div>
    );
  }
  return (
    <div className="ds-card st-opts">
      {timezoneOptions(settings.notifyTimezone).map(tz => option(tz.iana, tz.label, tz.iana === settings.notifyTimezone, { notifyTimezone: tz.iana }))}
    </div>
  );
}
