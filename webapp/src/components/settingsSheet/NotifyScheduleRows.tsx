import type { UserSettings } from '../../api';
import { FREQ_LABELS, pad, quietLabel, hourInQuiet } from '../../../../shared/src/settings/constants';
import { SRow, Toggle, ChevronVal } from './ui';
import type { SubView } from './SubViews';

interface Props {
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<unknown>;
  openSubView: (v: SubView) => void;
}

// Когда и как часто — строки раздела «Уведомления», пока включены напоминания
// или итоги дня (вынесены из NotificationsSection.tsx, правило №10). Часовой пояс —
// не здесь: он нужен и без уведомлений (NotificationsSection).
export function NotifyScheduleRows({ settings, patch, openSubView }: Props) {
  const localHour = settings.notifyLocalHour;
  return (
    <>
      <SRow title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} opens="time" onClick={() => openSubView('time')} />
      <SRow title="Частота" right={<ChevronVal text={FREQ_LABELS[settings.notifyFrequency ?? 0]} />} opens="freq" onClick={() => openSubView('freq')} />
      <SRow title="Игровой режим" sub="Серии и «ещё день до вехи»" right={<Toggle label="Игровой режим" on={!!settings.notifyGamified} onClick={() => patch({ notifyGamified: !settings.notifyGamified })} />} />
      <SRow title="Тихие часы" right={<ChevronVal text={quietLabel(settings.notifyQuietStart, settings.notifyQuietEnd)} />} opens="quiet" onClick={() => openSubView('quiet')} />
      {hourInQuiet(localHour, settings.notifyQuietStart, settings.notifyQuietEnd) && (
        <div className="st-text--warn">
          Время уведомления попадает в тихие часы — сообщение придёт после их окончания
        </div>
      )}
    </>
  );
}
