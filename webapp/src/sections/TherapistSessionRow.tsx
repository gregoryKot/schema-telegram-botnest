import type { CSSProperties } from 'react';
import type { TherapyClientSummary, UserId } from '../api';
import { SESSIONS_LOOK } from '../components/therapist/cabinetLook';
import { activityStatus, sessionTime } from './therapistTodayModel';
import { clientDisplayName } from '../../../shared/src/therapy/clientInitials';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void; tasksLine?: string | null }

// Строка «Сессии сегодня»: время Literata, имя и подпись активности — белая строка на листе неба.
// Под ней тихо — «задания: N выполнено · M ждёт» (нет заданий — строки нет). Знака нет ни в строке, ни у заголовка (r1): Talk стоит один раз — у счётчика «Сессий сегодня».
export function SessionRow({ client, onOpen, tasksLine }: RowProps) {
  const time = sessionTime(client);
  const sub = activityStatus(client).text; // у офлайн-клиента активности не бывает — пусто
  return (
    <button type="button" className="tt-session tt-reset" onClick={() => onOpen(client.telegramId)}>
      <span className="tt-time">{time || '—'}</span>
      <span className="tt-who">
        <span className="tt-name">{clientDisplayName(client)}</span>
        {sub && <span className="tt-row-sub">{sub}</span>}
        {tasksLine && <span className="tt-row-sub">{tasksLine}</span>}
      </span>
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}

/** Блок «Сессии сегодня»: лист неба терапевта; знак встреч — у счётчика выше, лист его не повторяет. `plain` —
 *  кабинет пуст: без листа, строкой (картинку пустого кабинета несёт одна сцена выше). */
export function SessionsBlock({ sessions, onOpen, plain, tasksLineOf }: {
  sessions: TherapyClientSummary[]; onOpen: (id: UserId) => void; plain?: boolean;
  tasksLineOf?: (c: TherapyClientSummary) => string | null;
}) {
  const head = <h2 className="ds-h2 tt-sessions-title">Сессии сегодня</h2>;
  const empty = <p className="ds-empty">Сессий не запланировано</p>;
  if (plain) return <div className="tt-sub">{head}{empty}</div>;
  // Пусто — строка на бумаге между линиями, без цветного листа: лист нужен только строкам сессий.
  if (sessions.length === 0) return <section className="pp-block tt-sessions-empty">{head}{empty}</section>;
  return (
    <section className="pp-paper tt-sessions" style={{ '--h': SESSIONS_LOOK.hue } as CSSProperties}>
      {head}
      <div className="tt-session-list">
        {sessions.map(c => <SessionRow key={c.telegramId} client={c} onOpen={onOpen} tasksLine={tasksLineOf?.(c)} />)}
      </div>
    </section>
  );
}
