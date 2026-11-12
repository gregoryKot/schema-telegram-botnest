import type { UserSettings } from '../../api';
import { SignChip } from '../paper/SignChip';
import { Tick } from './ui';
import { HOURS, FREQ_LABELS, QUIET_PRESETS, pad } from '../../../../shared/src/settings/constants';
import { timezoneOptions } from '../../../../shared/src/settings/timezones';

export type SubView = 'main' | 'time' | 'tz' | 'freq' | 'quiet';

interface Props {
  subView: Exclude<SubView, 'main'>;
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<unknown>;
  onDone: () => void;
}

// Подэкраны выбора (время, частота, тихие часы, пояс): тап по варианту
// сохраняет его и возвращает на главный экран настроек. Вид (b25): часы — чипы-листы,
// выбранный — бумага с галочкой (SignChip); списки — плоские строки через линию, у выбранной
// галочка-знак. Заголовок подэкрана рисует SettingsSheet в начале тела.
export function SettingsSubView({ subView, settings, patch, onDone }: Props) {
  const choose = (update: Partial<UserSettings>) => async () => { await patch(update); onDone(); };
  const option = (key: string | number, label: string, active: boolean, update: Partial<UserSettings>) => (
    <button key={key} type="button" aria-pressed={active} onClick={choose(update)}
      className="ds-list-row ds-list-row--nav ds-list-row--inset ds-list-row--hover"
    ><span className="ds-list-title">{label}</span>{active && <span className="st-check"><Tick /></span>}</button>
  );

  if (subView === 'time') {
    return (
      <div className="st-hours">
        {HOURS.map(h => (
          <SignChip key={h} label={`${pad(h)}:00`} on={h === settings.notifyLocalHour} onToggle={choose({ notifyLocalHour: h })} />
        ))}
      </div>
    );
  }
  if (subView === 'freq') {
    return (
      <div className="st-sub">
        <div className="st-text">
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
      <div className="st-sub">
        <div className="st-text">
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
    <div className="st-opts">
      {timezoneOptions(settings.notifyTimezone).map(tz => option(tz.iana, tz.label, tz.iana === settings.notifyTimezone, { notifyTimezone: tz.iana }))}
    </div>
  );
}
