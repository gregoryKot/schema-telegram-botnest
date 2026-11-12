import type { CSSProperties } from 'react';
import type { TherapyClientSummary, UserId } from '../api';
import { SignArt } from '../components/art/SignArt';
import { SESSIONS_LOOK } from '../components/therapist/cabinetLook';
import { activityStatus, sessionTime } from './therapistTodayModel';
import { clientDisplayName } from '../../../shared/src/therapy/clientInitials';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void }

// Строка «Сессии сегодня»: время Literata, имя и подпись активности — белая строка на листе неба.
// Знака в строке нет: Talk стоит один раз у заголовка листа (баг брифа — знак в каждой строке).
export function SessionRow({ client, onOpen }: RowProps) {
  const time = sessionTime(client);
  const sub = activityStatus(client).text; // у офлайн-клиента активности не бывает — пусто
  return (
    <button type="button" className="tt-session tt-reset" onClick={() => onOpen(client.telegramId)}>
      <span className="tt-time">{time || '—'}</span>
      <span className="tt-who">
        <span className="tt-name">{clientDisplayName(client)}</span>
        {sub && <span className="tt-row-sub">{sub}</span>}
      </span>
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}

/** Блок «Сессии сегодня»: лист неба терапевта, Talk один раз у заголовка. `plain` — кабинет пуст:
 *  без листа и знака, строкой (картинку пустого кабинета несёт одна сцена выше). */
export function SessionsBlock({ sessions, onOpen, plain }: {
  sessions: TherapyClientSummary[]; onOpen: (id: UserId) => void; plain?: boolean;
}) {
  const head = <h2 className="ds-h2 tt-sessions-title">Сессии сегодня</h2>;
  const empty = <p className="ds-empty">Сессий не запланировано</p>;
  if (plain) return <div className="tt-sub">{head}{empty}</div>;
  return (
    <section className="pp-paper tt-sessions" style={{ '--h': SESSIONS_LOOK.hue } as CSSProperties}>
      <div className="tt-sessions-head">
        {head}
        <span className="tt-sessions-sign" aria-hidden="true"><SignArt sign={SESSIONS_LOOK.sign} size="row" /></span>
      </div>
      {sessions.length === 0 ? empty : (
        <div className="tt-session-list">
          {sessions.map(c => <SessionRow key={c.telegramId} client={c} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}
