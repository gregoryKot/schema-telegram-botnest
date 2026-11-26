import { BASE } from '../../apiClient';
import { reportClientError } from '../../api';
import { trackGoal } from '../../lib/metrika';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { localDayLabel, localTimeLabel } from '../../../../shared/src/booking/clientTimeZone';
import { buildGoogleCalendarUrl } from './googleCalendarLink';

// Блок «Сохраните запись» — общий для DoneScreen (сразу после брони) и
// BookingPaidPage (после оплаты/по ссылке управления). Одна механика, один
// компонент: раньше в проекте уже был баг из-за двух копий похожей логики
// (правило «одна механика — один компонент», CLAUDE.md).
//
// Ссылки на встречу в блоке нет (аудит 2026-10): ответ записи и страница по
// токену анонимны, а комната клиента ищется по контакту — назвавший чужой
// контакт получил бы чужую комнату. Ссылку присылает владелец.

/** Безличная строка на месте ссылки — общая для экрана записи и «Оплачено». */
export const MEETING_LINK_LATER = 'Пришлю ссылку на встречу до начала сессии.';

interface Props {
  cancelToken: string;
  startsAt: string;
  durationMin: number;
  type: 'INTRO_15' | 'SESSION_50';
  tz: string;
}

export function BookingSaveBlock({ cancelToken, startsAt, durationMin, type, tz }: Props) {
  const manageUrl = `${window.location.origin}/booking/manage?token=${cancelToken}`;
  const icsUrl = `${BASE}/api/booking/ics/${cancelToken}`;
  const title = type === 'INTRO_15' ? 'Знакомство с Григорием Котляревским' : 'Встреча с Григорием Котляревским';
  const details = `Посмотреть или отменить запись: ${manageUrl}`;
  const googleUrl = buildGoogleCalendarUrl({ title, startsAt, durationMin, details });
  const shareText = `Моя запись: ${localDayLabel(startsAt, tz)}, ${localTimeLabel(startsAt, tz)} по моему времени. Здесь можно посмотреть или отменить.`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(manageUrl)}&text=${encodeURIComponent(shareText)}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const { copied, failed, copy } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'booking manage link copy failed', section: 'booking' }),
  });

  const onCopy = () => { void copy(manageUrl).then((ok) => { if (ok) trackGoal('booking_link_saved', { via: 'copy' }); }); };

  const onShare = () => {
    navigator.share({ title, text: shareText, url: manageUrl })
      .then(() => trackGoal('booking_link_saved', { via: 'share' }))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return; // отменили шторку — не сбой
        reportClientError({ message: `booking share failed: ${err instanceof Error ? err.message : String(err)}`, section: 'booking' });
      });
  };

  return (
    <div className="ym-hide-content pa-outcome-rows">
      <span className="ds-eyebrow pa-outcome-eyebrow">Сохраните запись</span>
      <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="pa-outcome-row" onClick={() => trackGoal('booking_calendar_add', { kind: 'google' })}>
        Google Календарь
      </a>
      <a href={icsUrl} className="pa-outcome-row" onClick={() => trackGoal('booking_calendar_add', { kind: 'ics' })}>
        Apple / Outlook (.ics)
      </a>
      <a href={telegramShareUrl} target="_blank" rel="noopener noreferrer" className="pa-outcome-row" onClick={() => trackGoal('booking_link_saved', { via: 'telegram' })}>
        Отправить себе в Telegram
      </a>
      <button type="button" className="pa-outcome-row" onClick={onCopy}>{copied ? 'Скопировано ✓' : 'Скопировать ссылку'}</button>
      {canShare && <button type="button" className="pa-outcome-row" onClick={onShare}>Поделиться…</button>}
      {failed && (
        <p style={{ fontSize: 12, color: 'var(--accent-red)', margin: '6px 0 0' }}>
          Не удалось скопировать — выделите ссылку и скопируйте вручную.
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, margin: '10px 0 0' }}>
        По этой ссылке можно посмотреть время и отменить запись. Не пересылайте её другим.
      </p>
    </div>
  );
}
