import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../Skeleton';
import { SRow, Toggle } from './ui';
import type { PushDevice, PushNotice } from '../../push/usePushDevice';

// «На этом устройстве» — веб-пуши в разделе «Уведомления» (docs/PWA_PLAN.md,
// 4.7). Состояние и действия — webapp/src/push/usePushDevice.ts; здесь только
// что показать в каждом состоянии. Вебвью Telegram/MAX и старый браузер
// строки не видят: включать там нечего.

const TITLE = 'На этом устройстве';

function noticeText(notice: PushNotice, tr: (ty: string, vy: string) => string): string {
  if (notice === 'not-delivered') {
    return tr(
      'Пробное уведомление не дошло. Проверь, разрешены ли уведомления в системе.',
      'Пробное уведомление не дошло. Проверьте, разрешены ли уведомления в системе.',
    );
  }
  return notice === 'enable-failed'
    ? tr('Не получилось включить — попробуй ещё раз.', 'Не получилось включить — попробуйте ещё раз.')
    : tr('Не получилось выключить — попробуй ещё раз.', 'Не получилось выключить — попробуйте ещё раз.');
}

interface Props {
  device: PushDevice;
  telegramLinked: boolean;
  onInstall: () => void; // страница /install: шаги установки на экран «Домой»
}

export function PushDeviceRow({ device, telegramLinked, onInstall }: Props) {
  const tr = useTr();
  const { state, busy, notice, toggle } = device;
  if (state === 'unsupported') return null;
  // Ключ сервера и подписка ещё едут — плашка по форме тумблера.
  if (state === null) return <SRow title={TITLE} right={<Skeleton width={44} height={26} radius={13} />} />;
  if (state === 'ios-install') {
    return (
      <div className="st-body-block">
        <p className="st-text">На iPhone и iPad уведомления приходят только в приложение с экрана «Домой».</p>
        <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onInstall}>Установить приложение</button>
      </div>
    );
  }
  if (state === 'denied') {
    return (
      <SRow title={TITLE} sub={tr(
        'Запрещены в настройках браузера — разреши уведомления для schemehappens.ru',
        'Запрещены в настройках браузера — разрешите уведомления для schemehappens.ru',
      )} />
    );
  }
  const on = state === 'on';
  const sub = on ? 'Приходят сюда' : telegramLinked ? 'Присылать сюда вместо Telegram' : 'Напоминания и итоги дня — сюда';
  return (
    <>
      <SRow title={TITLE} sub={sub} right={<Toggle label={TITLE} on={on} busy={busy} onClick={toggle} />} />
      {notice && <div className="st-text--warn" role="status">{noticeText(notice, tr)}</div>}
    </>
  );
}
