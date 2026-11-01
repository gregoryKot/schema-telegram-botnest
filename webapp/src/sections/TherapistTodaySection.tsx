import { useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { api } from '../api';
import type { TherapyClientSummary, UserId } from '../api';
import '../styles/therapist-today.css';
import { AttentionRow, ActivityRow, SessionRow } from './TherapistTodayLists';
import { needsAttention, sessionsTodaySorted, todayCounts } from './therapistTodayModel';
import { homeGreeting } from './today/helpers';
import { formatGreetingDate } from './today/greetingDate';

interface Props {
  displayName: string | null;
  onOpenClient: (id: UserId) => void;
}

export function TherapistTodaySection({ displayName, onOpenClient }: Props) {
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTherapyClients().then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const counts = todayCounts(clients);
  const sessions = sessionsTodaySorted(clients);
  const attention = clients.filter(needsAttention);

  return (
    <div className="ds-page tt-page animate-fade">
      <div>
        {/* Приветствие и дата — те же, что у клиентского «Сегодня» (одна механика). */}
        <div className="ds-eyebrow">{formatGreetingDate()}</div>
        <h1 className="ds-h1">{homeGreeting(displayName ?? '')}</h1>
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
            sessions.map(c => <SessionRow key={c.telegramId} client={c} onOpen={onOpenClient} />)
          )}
          {!loading && attention.length > 0 && (
            <>
              <h2 className="ds-h2">Требуют внимания</h2>
              <div className="tt-attn-list">
                {attention.map(c => <AttentionRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
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
              {clients.map(c => <ActivityRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
