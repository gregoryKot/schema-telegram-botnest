import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary, UserId } from '../api';
import { useTr } from '../utils/addressForm';
import '../styles/therapist-today.css';
import { AttentionRow, ActivityRow } from './TherapistTodayLists';
import { SessionsBlock } from './TherapistSessionRow';
import { TherapistTodayCounters } from './TherapistTodayCounters';
import { needsAttention, sessionsTodaySorted, todayCounts, trackedClients } from './therapistTodayModel';
import { TherapistTodayHead } from './TherapistTodayHead';
import { TodaySkeletonBody } from '../components/therapist/TodaySkeletonBody';
import { PaperAlert } from '../components/paper/PaperAlert';
import { CabinetEmpty } from '../components/therapist/CabinetEmpty';
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
// неправду о своей практике. Сбой — PaperAlert с «Повторить», загрузка — силуэт экрана
// (TodaySkeletonBody под шапкой), пустой кабинет — одна сцена SceneCabinet и «Добавить клиента» (b29:
// было три чашки подряд); пустые подсписки — тихой строкой без своих картинок.
export function TherapistTodaySection({ displayName, onOpenClient, onAddClient }: Props) {
  const tr = useTr();
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const fetchClients = useCallback(() => api.getTherapyClients()
    .then(c => { setClients(asArray(c)); setStatus('ready'); })
    .catch(() => setStatus('failed')), []);
  useEffect(() => { void fetchClients(); }, [fetchClients]);
  const retry = () => { setStatus('loading'); void fetchClients(); };

  if (status === 'loading') {
    return (
      <div className="ds-page tt-page">
        <TherapistTodayHead displayName={displayName} />
        <TodaySkeletonBody label="Загружаются клиенты" />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="ds-page tt-page animate-fade">
        <TherapistTodayHead displayName={displayName} />
        <PaperAlert sign="cluster" onRetry={retry}
          title={tr('Клиенты не загрузились. Проверь связь и попробуй ещё раз', 'Клиенты не загрузились. Проверьте связь и попробуйте ещё раз')} />
      </div>
    );
  }

  const counts = todayCounts(clients);
  const sessions = sessionsTodaySorted(clients);
  const attention = clients.filter(needsAttention);
  const empty = clients.length === 0;

  return (
    <div className="ds-page tt-page animate-fade">
      <TherapistTodayHead displayName={displayName} />

      {empty ? (
        <CabinetEmpty title="Клиентов пока нет"
          text={tr('Добавь первого: карточку для своих записей или приглашение в приложение', 'Добавьте первого: карточку для своих записей или приглашение в приложение')}>
          {onAddClient && <button type="button" className="ds-btn" onClick={onAddClient}>Добавить клиента</button>}
        </CabinetEmpty>
      ) : (
        <TherapistTodayCounters counts={counts} />
      )}

      <div className="tt-cols">
        <div className="tt-col">
          <SessionsBlock sessions={sessions} onOpen={onOpenClient} plain={empty} />
          {attention.length > 0 && (
            <div className="tt-sub">
              <h2 className="ds-h2">Требуют внимания</h2>
              <div className="tt-attn-list">
                {attention.map(c => <AttentionRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
              </div>
            </div>
          )}
        </div>

        <div className="tt-col">
          <div className="tt-sub">
            <h2 className="ds-h2">Активность клиентов</h2>
            {counts.total === 0 ? (
              <p className="ds-empty">{empty ? 'Появится, когда клиенты подключатся к приложению' : 'Активность видна у клиентов, подключённых к приложению'}</p>
            ) : (
              <div className="tt-list">
                {trackedClients(clients).map(c => <ActivityRow key={c.telegramId} client={c} onOpen={onOpenClient} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
