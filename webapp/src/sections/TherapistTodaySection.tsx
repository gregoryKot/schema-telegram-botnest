import { useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { api } from '../api';
import type { TherapyClientSummary, UserId } from '../api';
import '../styles/therapist-today.css';
import { AttentionRow, ActivityRow } from './TherapistTodayLists';
import { SessionRow } from './TherapistSessionRow';
import { needsAttention, sessionsTodaySorted, todayCounts, trackedClients } from './therapistTodayModel';
import { SignHead } from '../components/therapist/SignArt';
import { PaperEmpty } from '../components/art/PaperEmpty';
import { TherapistTodayHead } from './TherapistTodayHead';

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
      <TherapistTodayHead displayName={displayName} />

      {!loading && clients.length > 0 && (
        <div className="tt-counters">
          <div className="tt-counter ds-card ds-card--row">
            <div className="ds-label">Активны сегодня</div>
            <div className="ds-num">{counts.active}<span className="tt-denom"> / {counts.total}</span></div>
          </div>
          <div className="tt-counter ds-card ds-card--row">
            <div className="ds-label">Сессий сегодня</div>
            <div className="ds-num">{counts.sessions}</div>
          </div>
          <div className={`tt-counter ds-card ds-card--row${counts.attention > 0 ? ' tt-counter--warn' : ''}`}>
            <div className="ds-label">Требуют внимания</div>
            <div className="ds-num">{counts.attention}</div>
          </div>
        </div>
      )}

      <div className="tt-cols">
        <div className="tt-col">
          <SignHead kind="talk" className="ds-h2">Сессии сегодня</SignHead>
          {loading ? (
            [0, 1].map(i => <Skeleton key={i} height={74} radius={16} />)
          ) : sessions.length === 0 ? (
            <PaperEmpty>Сессий не запланировано</PaperEmpty>
          ) : (
            sessions.map(c => <SessionRow key={c.telegramId} client={c} onOpen={onOpenClient} />)
          )}
          {!loading && attention.length > 0 && (
            <>
              <SignHead kind="heart" className="ds-h2">Требуют внимания</SignHead>
              <div className="tt-attn-list">
                {attention.map(c => <AttentionRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
              </div>
            </>
          )}
        </div>

        <div className="tt-col">
          <SignHead kind="strokes" className="ds-h2">Активность клиентов</SignHead>
          {loading ? (
            <Skeleton height={192} radius={16} />
          ) : counts.total === 0 ? (
            <PaperEmpty>{clients.length === 0 ? 'Нет клиентов' : 'Активность видна у клиентов, подключённых к боту'}</PaperEmpty>
          ) : (
            <div className="ds-card ds-card--row ds-card--flush">
              {trackedClients(clients).map(c => <ActivityRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
