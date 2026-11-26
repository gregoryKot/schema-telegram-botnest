import { btnGhost } from './shared';
import { useCopyText } from './useCopyText';

/**
 * Ссылка на встречу в строке брони админки (ревью починки утечки ссылки, аудит
 * 2026-10). Клиент её на экране больше не видит — пересылает владелец, и
 * потерянный DM не должен оставлять его без ссылки. Список записей отдаётся
 * только под ключом админа (GET /api/booking/admin/list). ym-hide-content —
 * на случай, если Вебвизор когда-нибудь начнёт писать /admin.
 */
export function BookingMeetingLink({ meetingUrl }: { meetingUrl: string | null }) {
  const { copy, status } = useCopyText();
  if (!meetingUrl) return null;
  return (
    <div className="ym-hide-content" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap', fontSize: 13, marginTop: 6 }}>
      <span className="u-fg">Ссылка на встречу:</span>
      <a href={meetingUrl} target="_blank" rel="noreferrer" className="u-link" style={{ wordBreak: 'break-all' }}>{meetingUrl}</a>
      <button type="button" style={{ ...btnGhost, padding: '5px 12px', fontSize: 13 }} onClick={() => void copy(meetingUrl)}>Скопировать ссылку</button>
      {status}
    </div>
  );
}
