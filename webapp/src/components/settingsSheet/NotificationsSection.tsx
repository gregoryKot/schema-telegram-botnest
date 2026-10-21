import type { UserSettings } from '../../api';
import { botHandle } from '../../utils/botConfig';
import { FREQ_LABELS, pad, quietLabel, hourInQuiet } from '../../../../shared/src/settings/constants';
import { SSection, SRow, Toggle, ChevronVal } from './ui';
import type { SubView } from './SubViews';
import { SettingsInfoHelp } from './SettingsInfoHelp';

interface Props {
  settings: UserSettings;
  tzLabel: string;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  openSubView: (v: SubView) => void;
}

// Раздел «Уведомления» — вынесен из SettingsSheet.tsx (правило №10).
export function NotificationsSection({ settings, tzLabel, patch, openSubView }: Props) {
  const localHour = settings.notifyLocalHour;
  return (
    <SSection id="s-notifications" label="Уведомления" hint={`Приходят через Telegram — ${botHandle}`}
      help={<SettingsInfoHelp infoKey="notify" />}>
      {settings.notifyPausedUntil && new Date(settings.notifyPausedUntil) > new Date() && (
        <div className="st-pause">
          <span className="st-text">
            ⏸ Уведомления на паузе до {new Date(settings.notifyPausedUntil).toLocaleDateString('ru-RU')}
          </span>
          <button className="ds-link" onClick={() => patch({ notifyPausedUntil: null } as Partial<UserSettings>)}>Возобновить</button>
        </div>
      )}
      <SRow title="Итоги дня" sub="Ежедневный отчёт по потребностям" right={<Toggle on={settings.notifyEnabled} onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })} />} />
      <SRow title="Напоминание" sub="Заполнить трекер вечером" right={<Toggle on={!!settings.notifyReminderEnabled} onClick={() => patch({ notifyReminderEnabled: !settings.notifyReminderEnabled })} />} />
      {(settings.notifyEnabled || settings.notifyReminderEnabled) && (<>
        <SRow title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} onClick={() => openSubView('time')} />
        <SRow title="Частота" right={<ChevronVal text={FREQ_LABELS[settings.notifyFrequency ?? 0]} small />} onClick={() => openSubView('freq')} />
        <SRow title="Игровой режим" sub="Серии и «ещё день до вехи»" right={<Toggle on={!!settings.notifyGamified} onClick={() => patch({ notifyGamified: !settings.notifyGamified })} />} />
        <SRow title="Тихие часы" right={<ChevronVal text={quietLabel(settings.notifyQuietStart, settings.notifyQuietEnd)} small />} onClick={() => openSubView('quiet')} />
        <SRow title="Часовой пояс" right={<ChevronVal text={tzLabel} small />} onClick={() => openSubView('tz')} />
        {hourInQuiet(localHour, settings.notifyQuietStart, settings.notifyQuietEnd) && (
          <div className="st-text--warn">
            Время уведомления попадает в тихие часы — сообщение придёт после их окончания
          </div>
        )}
      </>)}
    </SSection>
  );
}
