import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { api } from '../api';
import type { TherapyClientSummary, UserId } from '../api';
import { useTr } from '../utils/addressForm';
import '../styles/therapist-today.css';
import { AttentionRow, ActivityRow } from './TherapistTodayLists';
import { SessionRow } from './TherapistSessionRow';
import { needsAttention, sessionsTodaySorted, todayCounts, trackedClients } from './therapistTodayModel';
import { SignHead } from '../components/therapist/SignArt';
import { PaperEmpty } from '../components/art/PaperEmpty';
import { TherapistTodayHead } from './TherapistTodayHead';
import { asArray } from './today/safeData';

interface Props {
  displayName: string | null;
  onOpenClient: (id: UserId) => void;
  /** «Добавить клиента» у нового терапевта: список клиентов, где форма открыта сразу. */
  onAddClient?: () => void;
}

type Status = 'loading' | 'ready' | 'failed';

// «Сегодня» кабинета. Аудит 2026-11 (U11): сбой загрузки глушился пустым catch,
// и при плохой связи терапевт видел «Нет клиентов» и «Сессий не запланировано» —
// неправду о своей практике. Теперь сбой — сообщение и «Повторить», загрузка —
// силуэт счётчиков и колонок, пустой кабинет — первое действие «Добавить клиента».
export function TherapistTodaySection({ displayName, onOpenClient, onAddClient }: Props) {
  const tr = useTr();
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const fetchClients = useCallback(() => api.getTherapyClients()
    .then(c => { setClients(asArray(c)); setStatus('ready'); })
    .catch(() => setStatus('failed')), []);
  useEffect(() => { void fetchClients(); }, [fetchClients]);
  const retry = () => { setStatus('loading'); void fetchClients(); };

  const loading = status === 'loading';
  const counts = todayCounts(clients);
  const sessions = sessionsTodaySorted(clients);
  const attention = clients.filter(needsAttention);

  if (status === 'failed') {
    return (
      <div className="ds-page tt-page animate-fade">
        <TherapistTodayHead displayName={displayName} />
        <div role="alert" className="ds-card tt-failed">
          <p className="ds-empty">{tr('Клиенты не загрузились. Проверь связь и попробуй ещё раз.', 'Клиенты не загрузились. Проверьте связь и попробуйте ещё раз.')}</p>
          <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={retry}>Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-page tt-page animate-fade">
      <TherapistTodayHead displayName={displayName} />

      {loading && (
        <div className="tt-counters" role="status" aria-label="Загружаются клиенты">
          {[0, 1, 2].map(i => <Skeleton key={i} height={118} radius={16} />)}
        </div>
      )}
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
      {!loading && clients.length === 0 && (
        <div className="tt-first">
          <PaperEmpty title="Клиентов пока нет">
            {tr('Добавь первого: карточку для своих записей или приглашение в приложение', 'Добавьте первого: карточку для своих записей или приглашение в приложение')}
          </PaperEmpty>
          {onAddClient && <button type="button" className="ds-btn" onClick={onAddClient}>Добавить клиента</button>}
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
            <PaperEmpty>{clients.length === 0 ? 'Появится, когда клиенты подключатся к приложению' : 'Активность видна у клиентов, подключённых к приложению'}</PaperEmpty>
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
