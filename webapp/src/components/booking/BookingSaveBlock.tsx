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

interface Props {
  cancelToken: string;
  startsAt: string;
  durationMin: number;
  type: 'INTRO_15' | 'SESSION_50';
  meetingUrl: string | null;
  tz: string;
}

const rowSt: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-10)', margin: '8px 0 0' };
const btnSt: React.CSSProperties = {
  minHeight: 44, padding: '10px 16px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
  borderRadius: 'var(--r-10)', border: '1.5px solid var(--line-strong)', background: 'transparent',
  color: 'var(--text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
};

export function BookingSaveBlock({ cancelToken, startsAt, durationMin, type, meetingUrl, tz }: Props) {
  const manageUrl = `${window.location.origin}/booking/manage?token=${cancelToken}`;
  const icsUrl = `${BASE}/api/booking/ics/${cancelToken}`;
  const title = type === 'INTRO_15' ? 'Знакомство с Григорием Котляревским' : 'Встреча с Григорием Котляревским';
  const details = [meetingUrl ? `Ссылка на встречу: ${meetingUrl}` : null, `Посмотреть или отменить запись: ${manageUrl}`]
    .filter(Boolean).join('\n');
  const googleUrl = buildGoogleCalendarUrl({ title, startsAt, durationMin, details });
  const shareText = `Моя запись: ${localDayLabel(startsAt, tz)}, ${localTimeLabel(startsAt, tz)} по моему времени. Здесь можно посмотреть или отменить.`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(manageUrl)}&text=${encodeURIComponent(shareText)}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const { copied, failed, copy } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'booking manage link copy failed', section: 'booking' }),
  });
  const { copied: meetingCopied, copy: copyMeeting } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'booking meeting link copy failed', section: 'booking' }),
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
    <div style={{ margin: '18px auto 0', maxWidth: 420, textAlign: 'left' }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: 0 }}>
        Сохраните запись
      </p>
      <div style={rowSt}>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={btnSt} onClick={() => trackGoal('booking_calendar_add', { kind: 'google' })}>
          Google Календарь
        </a>
        <a href={icsUrl} style={btnSt} onClick={() => trackGoal('booking_calendar_add', { kind: 'ics' })}>
          Apple / Outlook (.ics)
        </a>
      </div>
      <div style={rowSt}>
        <a href={telegramShareUrl} target="_blank" rel="noopener noreferrer" style={btnSt} onClick={() => trackGoal('booking_link_saved', { via: 'telegram' })}>
          Отправить себе в Telegram
        </a>
        <button type="button" style={btnSt} onClick={onCopy}>{copied ? 'Скопировано ✓' : 'Скопировать ссылку'}</button>
        {canShare && <button type="button" style={btnSt} onClick={onShare}>Поделиться…</button>}
      </div>
      {failed && (
        <p style={{ fontSize: 12, color: 'var(--accent-red)', margin: '6px 0 0' }}>
          Не удалось скопировать — выделите ссылку и скопируйте вручную.
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, margin: '10px 0 0' }}>
        По этой ссылке можно посмотреть время, ссылку на встречу и отменить запись. Не пересылайте её другим.
      </p>
      {meetingUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', margin: '10px 0 0' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Ссылка на встречу:</span>
          <button type="button" style={{ ...btnSt, minHeight: 32, padding: '6px 12px' }} onClick={() => void copyMeeting(meetingUrl)}>
            {meetingCopied ? 'Скопировано ✓' : 'Скопировать'}
          </button>
        </div>
      )}
    </div>
  );
}
