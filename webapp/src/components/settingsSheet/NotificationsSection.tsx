import type { UserSettings } from '../../api';
import { botHandle } from '../../utils/botConfig';
import { useTr } from '../../utils/addressForm';
import { SSection, SRow, Toggle } from './ui';
import type { SubView } from './SubViews';
import { SettingsInfoHelp } from './SettingsInfoHelp';
import { NotifyScheduleRows } from './NotifyScheduleRows';
import { PushDeviceRow } from './PushDeviceRow';
import { usePushDevice } from '../../push/usePushDevice';
import { notifyChannelHint, notifyChannelOf, notifyUnreachableCopy } from '../../../../shared/src/settings/notifyReach';
import { remindersOn, remindersPatch, summaryOn } from '../../../../shared/src/settings/notifyToggles';

interface Props {
  settings: UserSettings;
  tzLabel: string;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  openSubView: (v: SubView) => void;
  leaveTo: (path: '/account' | '/install') => void; // закрыть лист и уйти: привязать Telegram / установить приложение
  reloadSettings: () => Promise<void>; // после включения пушей на устройстве меняется notifyChannel
}

// Раздел «Уведомления» — вынесен из SettingsSheet.tsx (правило №10). Канал —
// веб-пуш на устройстве или Telegram (shared/src/settings/notifyReach.ts); без
// канала вместо тумблеров — честная причина и два пути (QA 2026-11, З5).
// Два тумблера — shared/src/settings/notifyToggles.ts.
export function NotificationsSection({ settings, tzLabel, patch, openSubView, leaveTo, reloadSettings }: Props) {
  const tr = useTr();
  const channel = notifyChannelOf(settings);
  const push = usePushDevice(channel, reloadSettings);
  const [reminders, summary] = [remindersOn(settings), summaryOn(settings)];
  const unreachable = notifyUnreachableCopy(tr, push.state !== 'unsupported');
  return (
    <SSection id="s-notifications" label="Уведомления" hint={notifyChannelHint(channel, botHandle)}
      help={<SettingsInfoHelp infoKey="notify" />}>
      {settings.notifyPausedUntil && new Date(settings.notifyPausedUntil) > new Date() && (
        <div className="st-pause">
          <span className="st-text">
            ⏸ Уведомления на паузе до {new Date(settings.notifyPausedUntil).toLocaleDateString('ru-RU')}
          </span>
          <button className="ds-link" onClick={() => patch({ notifyPausedUntil: null } as Partial<UserSettings>)}>Возобновить</button>
        </div>
      )}
      <PushDeviceRow device={push} telegramLinked={settings.telegramLinked ?? channel === 'telegram'} onInstall={() => leaveTo('/install')} />
      {channel ? (<>
        <SRow title="Напоминания" sub="Заполнить трекер в выбранный час" right={<Toggle label="Напоминания" on={reminders} onClick={() => patch(remindersPatch(!reminders))} />} />
        <SRow title="Итоги дня" sub="Сводка и вехи после заполнения трекера" right={<Toggle label="Итоги дня" on={summary} onClick={() => patch({ notifySummaryEnabled: !summary })} />} />
      </>) : (
        <div className="st-body-block" role="note">
          <p className="st-text">{unreachable.text}</p>
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => leaveTo('/account')}>{unreachable.linkButton}</button>
        </div>
      )}
      {channel && (reminders || summary) && (
        <NotifyScheduleRows settings={settings} tzLabel={tzLabel} patch={patch} openSubView={openSubView} />
      )}
    </SSection>
  );
}
