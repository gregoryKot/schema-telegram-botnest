import { useEffect, useState } from 'react';
import { getHost } from '../../../../shared/src/host';
import type { UserSettings } from '../../../../shared/src/apiTypes';
import { useTr } from '../../utils/addressForm';
import { usePushDevice } from '../../push/usePushDevice';
import { markSheetOpen } from '../../hooks/openSheets';
import { reminderTime } from './reminderHintRules';
import { markReminderHintSeen } from './reminderHintSeen';

const noop = () => {};
const BTN = { minHeight: 44, minWidth: 44 } as const;

/** Одна строка при первом входе: вечернее напоминание придёт само, где его выключить. Не лист — карточка снизу. */
export function ReminderHint({ settings, onClose }: { settings: UserSettings; onClose: () => void }) {
  const tr = useTr();
  const [asked, setAsked] = useState(false);
  const push = usePushDevice(settings.notifyChannel ?? null, noop);
  const offerPush = getHost().id === 'web' && settings.notifyChannel !== 'push'
    && (push.state === 'off' || push.state === 'on');

  // Отметка «слой открыт» прячет баннер куки: обе карточки стоят на одном месте внизу.
  useEffect(() => markSheetOpen('reminder-hint'), []);

  const close = () => { markReminderHintSeen(); onClose(); };
  // Нажали «Включить push» и подписка встала — подсказка своё сказала.
  useEffect(() => {
    if (asked && push.state === 'on') { markReminderHintSeen(); onClose(); }
  }, [asked, push.state, onClose]);

  return (
    <div className="cookie-banner-wrap">
      <div className="light-lock pp-paper cookie-banner" role="status">
        <p className="cookie-text">
          {`Вечером в ${reminderTime(settings.notifyLocalHour)} напомню о дне — время и выключение в настройках`}
          {offerPush && ` ${tr('Чтобы напоминание дошло, включи уведомления в браузере', 'Чтобы напоминание дошло, включите уведомления в браузере')}`}
        </p>
        {offerPush && push.state === 'off' && (
          <button type="button" className="ds-btn" style={BTN} disabled={push.busy} onClick={() => { setAsked(true); push.toggle(); }}>Включить push</button>
        )}
        <button type="button" className="ds-btn" style={BTN} onClick={close}>Хорошо</button>
      </div>
    </div>
  );
}
