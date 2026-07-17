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
    // If nextSession is in the future or past – don't fall through to meetingDays
    // (meetingDays is the recurring pattern, nextSession is the specific override)
    return false;
  }
  // No explicit nextSession – use recurring meetingDays
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
  // «Сейчас» фиксируется при монтировании: Date.now() в теле рендера
  // недетерминирован (react-hooks/purity), а данные всё равно грузятся на
  // маунте. Значения — дневного масштаба, замер на маунте достаточен.
  const [now] = useState(() => Date.now());

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
    const daysSince = Math.floor((now - new Date(last).getTime()) / 86400000);
    return daysSince >= 3;
  });

  return (
    <div className="page animate-fade">
      <div className="page-inner-wide">
        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{todayLabel()}</div>
          <h1 className="hub-title" style={{ marginBottom: 0 }}>
            {greeting(displayName)}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {/* Sessions today */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Сессии сегодня</div>
              {loading ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Загрузка…</div>
              ) : sessionsToday.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Сессий не запланировано</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                  {sessionsToday
                    .slice()
                    .sort((a, b) => (sessionTime(a) || '99:99').localeCompare(sessionTime(b) || '99:99'))
                    .map(c => {
                      const time = sessionTime(c);
                      return (
                        <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                            borderBottom: '1px solid rgba(var(--fg-rgb),0.07)', border: 'none',
                            background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)', flex: 1 }}>
                            {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                          </span>
                          {time && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{time}</span>}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Client activity */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Активность клиентов</div>
              {loading ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Загрузка…</div>
              ) : clients.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 14, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Нет клиентов</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                  {clients.map(c => {
                    const name = c.clientAlias ?? c.name ?? `#${c.telegramId}`;
                    const done = c.todayIndex != null;
                    return (
                      <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                          borderBottom: '1px solid rgba(var(--fg-rgb),0.07)', border: 'none',
                          background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                          background: done ? 'var(--c-moss)' : 'rgba(var(--fg-rgb),0.15)' }} />
                        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, flex: 1 }}>{name}</span>
                        {done && c.todayIndex != null && (
                          <span style={{ fontSize: 13, fontFamily: 'var(--serif)', color: 'var(--text-sub)' }}>
                            {c.todayIndex.toFixed(1)}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                          {done ? 'заполнил' : c.lastActiveDate
                            ? `${Math.floor((now - new Date(c.lastActiveDate).getTime()) / 86400000)} дн.`
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {/* Summary stats */}
            {!loading && clients.length > 0 && (
              <div style={{ display: 'flex', gap: 48 }}>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400,
                    lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                    {activeToday.length}
                    <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18,
                      color: 'var(--text-ghost)', marginLeft: 4 }}>/{clients.length}</span>
                  </div>
                  <div className="eyebrow" style={{ marginTop: 6 }}>активны сегодня</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400,
                    lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                    {sessionsToday.length}
                  </div>
                  <div className="eyebrow" style={{ marginTop: 6 }}>сессий сегодня</div>
                </div>
              </div>
            )}

            {/* Needs attention */}
            {needingAttention.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--c-amber)',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--c-amber)', display: 'inline-block' }} />
                  Требуют внимания
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                  {needingAttention.map(c => (
                    <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                        borderBottom: '1px solid rgba(var(--fg-rgb),0.07)', border: 'none',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, flex: 1 }}>
                        {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {c.lastActiveDate
                          ? `${Math.floor((now - new Date(c.lastActiveDate).getTime()) / 86400000)} дн.`
                          : 'нет данных'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active today */}
            {activeToday.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 14 }}>Заполнили сегодня</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                  {activeToday.map(c => (
                    <button key={c.telegramId} onClick={() => onOpenClient(c.telegramId)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        fontSize: 14, color: 'var(--c-moss)', fontWeight: 500 }}>
                      {c.clientAlias ?? c.name ?? `#${c.telegramId}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
