import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary } from '../api';

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

/** True if the client has a session scheduled for today */
function hasSessionToday(c: TherapyClientSummary): boolean {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().getDay();
  // nextSession wins: if explicitly set to today, show it
  if (c.nextSession) {
    const sessionDate = c.nextSession.slice(0, 10);
    if (sessionDate === todayStr) return true;
    // If nextSession is in the future or past — don't fall through to meetingDays
    // (meetingDays is the recurring pattern, nextSession is the specific override)
    return false;
  }
  // No explicit nextSession — use recurring meetingDays
  return c.meetingDays.includes(todayDay);
}

/** Extract HH:MM time from nextSession if it's today */
function sessionTime(c: TherapyClientSummary): string {
  if (!c.nextSession) return '';
  const todayStr = new Date().toISOString().slice(0, 10);
  if (c.nextSession.slice(0, 10) !== todayStr) return '';
  return c.nextSession.includes('T') ? c.nextSession.split('T')[1].slice(0, 5) : '';
}

interface Props {
  displayName: string | null;
  onOpenClient: (id: number) => void;
}

export function TherapistTodaySection({ displayName, onOpenClient }: Props) {
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTherapyClients().then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeToday = clients.filter(c => c.todayIndex != null);
  const sessionsToday = clients.filter(hasSessionToday);

  // Clients with no activity for 3+ days (and not active today)
  const needingAttention = clients.filter(c => {
    if (c.todayIndex != null) return false;
    const last = c.lastActiveDate;
    if (!last) return true;
    const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    return daysSince >= 3;
  });

  return (
    <div className="page animate-fade">
      <div className="page-inner" style={{ maxWidth: 780 }}>
        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{todayLabel()}</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 0 }}>
            {greeting(displayName)}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Sessions today */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Сессии сегодня</div>
              {loading ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Загрузка…</div>
              ) : sessionsToday.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>Сессий не запланировано</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sessionsToday
                    .slice()
                    .sort((a, b) => (sessionTime(a) || '99:99').localeCompare(sessionTime(b) || '99:99'))
                    .map(c => {
                      const time = sessionTime(c);
                      return (
                        <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                            {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                          </span>
                          {time && (
                            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>{time}</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Client activity */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Активность клиентов</div>
              {loading ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Загрузка…</div>
              ) : clients.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>Нет клиентов</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clients.map(c => {
                    const name = c.clientAlias ?? c.name ?? `#${c.telegramId}`;
                    const done = c.todayIndex != null;
                    return (
                      <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                          background: done ? '#06d6a0' : 'var(--surface-3)',
                          border: done ? 'none' : '1.5px solid var(--line-strong)' }} />
                        <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{name}</span>
                        {done && c.todayIndex != null && (
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
                            {c.todayIndex.toFixed(1)}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)', marginLeft: done ? 4 : 'auto' }}>
                          {done ? 'заполнил' : c.lastActiveDate
                            ? `${Math.floor((Date.now() - new Date(c.lastActiveDate).getTime()) / 86400000)} дн.`
                            : 'нет данных'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Needs attention */}
            {needingAttention.length > 0 && (
              <div className="card" style={{ padding: '20px 24px', borderLeft: '3px solid var(--c-amber)' }}>
                <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--c-amber)' }}>Требуют внимания</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {needingAttention.map(c => (
                    <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                        {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                        {c.lastActiveDate
                          ? `${Math.floor((Date.now() - new Date(c.lastActiveDate).getTime()) / 86400000)} дн. без активности`
                          : 'нет данных'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active today */}
            {activeToday.length > 0 && (
              <div className="card" style={{ padding: '20px 24px' }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Заполнили сегодня</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeToday.map(c => (
                    <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                            style={{ padding: '4px 10px', borderRadius: 999, border: 'none', background: 'rgba(6,214,160,0.12)', color: '#059669', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary stats */}
            {!loading && clients.length > 0 && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="card" style={{ flex: 1, padding: '16px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{activeToday.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>из {clients.length} активны</div>
                </div>
                <div className="card" style={{ flex: 1, padding: '16px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{sessionsToday.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>сессий сегодня</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
