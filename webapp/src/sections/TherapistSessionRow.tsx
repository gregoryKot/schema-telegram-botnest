import type { TherapyClientSummary, UserId } from '../api';
import { clientHue, hueStyle } from '../lib/tone';
import { Sign } from '../components/therapist/SignArt';
import { activityStatus, sessionTime } from './therapistTodayModel';
import { clientDisplayName } from '../../../shared/src/therapy/clientInitials';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void }

// Строка «Сессии сегодня»: аватара нет (время и полоска цвета клиента), поэтому слева знак встречи.
export function SessionRow({ client, onOpen }: RowProps) {
  const time = sessionTime(client);
  const sub = activityStatus(client).text; // у офлайн-клиента активности не бывает — пусто
  return (
    <button type="button" className="ds-card ds-card--row ds-card--hover tt-session tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="tt-time">{time || '—'}</span>
      <span className="tt-bar tone-fill" style={hueStyle(clientHue(client.telegramId))} />
      <span className="tt-who tt-who--sign">
        <Sign kind="talk" />
        <span className="tt-who-text">
          <span className="tt-name" style={{ display: 'block' }}>{clientDisplayName(client)}</span>
          {sub && <span className="tt-row-sub" style={{ display: 'block' }}>{sub}</span>}
        </span>
      </span>
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}
