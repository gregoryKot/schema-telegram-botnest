import { useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { api } from '../api';
import type { TherapyClientSummary, UserId } from '../api';
import '../styles/therapist-today.css';
import { AttentionRow, ActivityRow, SessionRow } from './TherapistTodayLists';
import { needsAttention, sessionsTodaySorted, todayCounts } from './therapistTodayModel';

const DAY_NAMES_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function todayLabel() {
  const now = new Date();
  return `${DAY_NAMES_RU[now.getDay()]}, ${now.getDate()} ${MONTHS_RU[now.getMonth()]}`;
}

function greeting(name: string | null) {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Доброе утро' : h < 17 ? 'Добрый день' : 'Добрый вечер';
  return name ? `${salutation}, ${name}` : salutation;
}

interface Props {
  displayName: string | null;
  onOpenClient: (id: UserId) => void;
}

export function TherapistTodaySection({ displayName, onOpenClient }: Props) {
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // «Сейчас» фиксируется при монтировании: Date.now() в теле рендера
  // недетерминирован (react-hooks/purity), а данные всё равно грузятся на
  // маунте. Значения — дневного масштаба, замер на маунте достаточен.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    api.getTherapyClients().then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const counts = todayCounts(clients, now);
  const sessions = sessionsTodaySorted(clients);
  const attention = clients.filter(c => needsAttention(c, now));

  return (
    <div className="ds-page tt-page animate-fade">
      <div>
        <div className="ds-eyebrow">{todayLabel()}</div>
        <h1 className="ds-h1">{greeting(displayName)}</h1>
      </div>

      {!loading && clients.length > 0 && (
        <div className="tt-counters">
          <div className="tt-counter ds-card ds-card--ink">
            <div className="ds-label">Активны сегодня</div>
            <div className="ds-num">{counts.active}<span className="tt-denom"> / {counts.total}</span></div>
          </div>
          <div className="tt-counter tt-counter--plain ds-card">
            <div className="ds-label">Сессий сегодня</div>
            <div className="ds-num">{counts.sessions}</div>
          </div>
          <div className="tt-counter tt-counter--warn ds-card ds-card--warn">
            <div className="ds-label">Требуют внимания</div>
            <div className="ds-num">{counts.attention}</div>
          </div>
        </div>
      )}

      <div className="tt-cols">
        <div className="tt-col">
          <h2 className="ds-h2">Сессии сегодня</h2>
          {loading ? (
            [0, 1].map(i => <Skeleton key={i} height={74} radius={16} />)
          ) : sessions.length === 0 ? (
            <div className="tt-empty">Сессий не запланировано</div>
          ) : (
            sessions.map(c => <SessionRow key={c.telegramId} client={c} now={now} onOpen={onOpenClient} />)
          )}
          {!loading && attention.length > 0 && (
            <>
              <h2 className="ds-h2">Требуют внимания</h2>
              <div className="tt-attn-list">
                {attention.map(c => <AttentionRow key={c.telegramId} client={c} now={now} onOpen={onOpenClient} />)}
              </div>
            </>
          )}
        </div>

        <div className="tt-col">
          <h2 className="ds-h2">Активность клиентов</h2>
          {loading ? (
            <Skeleton height={192} radius={16} />
          ) : clients.length === 0 ? (
            <div className="tt-empty">Нет клиентов</div>
          ) : (
            <div className="ds-card ds-card--flush" style={{ borderRadius: 16 }}>
              {clients.map(c => <ActivityRow key={c.telegramId} client={c} now={now} onOpen={onOpenClient} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
