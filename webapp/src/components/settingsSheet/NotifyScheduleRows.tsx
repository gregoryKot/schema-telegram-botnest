import type { UserSettings } from '../../api';
import { FREQ_LABELS, pad, quietLabel, hourInQuiet } from '../../../../shared/src/settings/constants';
import { SRow, Toggle, ChevronVal } from './ui';
import type { SubView } from './SubViews';

interface Props {
  settings: UserSettings;
  tzLabel: string;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  openSubView: (v: SubView) => void;
}

// Когда и как часто — строки раздела «Уведомления», пока включены напоминания
// или итоги дня (вынесены из NotificationsSection.tsx, правило №10).
export function NotifyScheduleRows({ settings, tzLabel, patch, openSubView }: Props) {
  const localHour = settings.notifyLocalHour;
  return (
    <>
      <SRow title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} onClick={() => openSubView('time')} />
      <SRow title="Частота" right={<ChevronVal text={FREQ_LABELS[settings.notifyFrequency ?? 0]} />} onClick={() => openSubView('freq')} />
      <SRow title="Игровой режим" sub="Серии и «ещё день до вехи»" right={<Toggle label="Игровой режим" on={!!settings.notifyGamified} onClick={() => patch({ notifyGamified: !settings.notifyGamified })} />} />
      <SRow title="Тихие часы" right={<ChevronVal text={quietLabel(settings.notifyQuietStart, settings.notifyQuietEnd)} />} onClick={() => openSubView('quiet')} />
      <SRow title="Часовой пояс" right={<ChevronVal text={tzLabel} />} onClick={() => openSubView('tz')} />
      {hourInQuiet(localHour, settings.notifyQuietStart, settings.notifyQuietEnd) && (
        <div className="st-text--warn">
          Время уведомления попадает в тихие часы — сообщение придёт после их окончания
        </div>
      )}
    </>
  );
}
