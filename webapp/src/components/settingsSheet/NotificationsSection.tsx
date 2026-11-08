import type { UserSettings } from '../../api';
import { botHandle } from '../../utils/botConfig';
import { FREQ_LABELS, pad, quietLabel, hourInQuiet } from '../../../../shared/src/settings/constants';
import { SSection, SRow, Toggle, ChevronVal } from './ui';
import type { SubView } from './SubViews';
import { SettingsInfoHelp } from './SettingsInfoHelp';
import { NOTIFY_UNREACHABLE, notifyReachable } from '../../../../shared/src/settings/notifyReach';
import { remindersOn, remindersPatch, summaryOn } from '../../../../shared/src/settings/notifyToggles';

interface Props {
  settings: UserSettings;
  tzLabel: string;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  openSubView: (v: SubView) => void;
  onOpenAccount: () => void; // «Аккаунт» — там привязывают Telegram, куда приходят уведомления
}

// Раздел «Уведомления» — вынесен из SettingsSheet.tsx (правило №10). Без
// Telegram уведомлениям некуда прийти: вместо тумблеров — честная причина и
// путь привязать его (QA 2026-11, З5). Два тумблера — shared/src/settings/notifyToggles.ts.
export function NotificationsSection({ settings, tzLabel, patch, openSubView, onOpenAccount }: Props) {
  const localHour = settings.notifyLocalHour;
  const [reachable, reminders, summary] = [notifyReachable(settings), remindersOn(settings), summaryOn(settings)];
  return (
    <SSection id="s-notifications" label="Уведомления" hint={reachable ? `Приходят через Telegram — ${botHandle}` : NOTIFY_UNREACHABLE.hint}
      help={<SettingsInfoHelp infoKey="notify" />}>
      {settings.notifyPausedUntil && new Date(settings.notifyPausedUntil) > new Date() && (
        <div className="st-pause">
          <span className="st-text">
            ⏸ Уведомления на паузе до {new Date(settings.notifyPausedUntil).toLocaleDateString('ru-RU')}
          </span>
          <button className="ds-link" onClick={() => patch({ notifyPausedUntil: null } as Partial<UserSettings>)}>Возобновить</button>
        </div>
      )}
      {reachable ? (<>
        <SRow title="Напоминания" sub="Заполнить трекер в выбранный час" right={<Toggle label="Напоминания" on={reminders} onClick={() => patch(remindersPatch(!reminders))} />} />
        <SRow title="Итоги дня" sub="Сводка и вехи после заполнения трекера" right={<Toggle label="Итоги дня" on={summary} onClick={() => patch({ notifySummaryEnabled: !summary })} />} />
      </>) : (
        <div className="st-body-block" role="note">
          <p className="st-text">{NOTIFY_UNREACHABLE.text}</p>
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onOpenAccount}>{NOTIFY_UNREACHABLE.linkButton}</button>
        </div>
      )}
      {reachable && (reminders || summary) && (<>
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
      </>)}
    </SSection>
  );
}
