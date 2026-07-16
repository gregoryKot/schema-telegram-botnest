import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Achievement, TherapyRelationInfo } from '../api';
import { TherapyNote } from '../components/TherapyNote';
import { MyNotesSheet } from '../components/MyNotesSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { useAuth } from '../auth/AuthContext';
import { useTr } from '../utils/addressForm';

export const DEFAULT_SECTION_KEY = 'default_section';

const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность', autonomy: 'Автономия',
  expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
};

const ACHIEVEMENT_META: Record<string, { emoji: string; title: string; desc: string }> = {
  first_day:      { emoji: '🌱', title: 'Первый шаг',   desc: 'Заполнил дневник первый раз' },
  streak_3:       { emoji: '🔥', title: 'Начало серии', desc: '3 дня подряд' },
  streak_7:       { emoji: '⭐', title: 'Неделя',        desc: '7 дней подряд' },
  streak_14:      { emoji: '💫', title: 'Две недели',    desc: '14 дней подряд' },
  streak_30:      { emoji: '🏆', title: 'Месяц',         desc: '30 дней подряд' },
  streak_100:     { emoji: '👑', title: 'Сотня',         desc: '100 дней подряд' },
  total_10:       { emoji: '📅', title: '10 дней',       desc: '10 дней всего' },
  total_50:       { emoji: '📆', title: '50 дней',       desc: '50 дней всего' },
  high_day:       { emoji: '✨', title: 'Хороший день',  desc: 'Средний индекс выше 8' },
  all_above7:     { emoji: '🎯', title: 'Баланс',        desc: 'Все потребности выше 7 в один день' },
  comeback:       { emoji: '🔄', title: 'Возвращение',   desc: 'Вернулся после перерыва в 3+ дня' },
  growth:         { emoji: '📈', title: 'Рост',          desc: 'Потребность выросла на 3+ за неделю' },
  pair_connected: { emoji: '🤝', title: 'Партнёр',       desc: 'Связался с партнёром' },
};

type StreakData = { currentStreak: number; longestStreak: number; totalDays: number; todayDone: boolean; weekDots: boolean[] };
type InsightsData = { weeklyStats: Array<{ needId: string; avg: number | null; trend: '↑' | '↓' | '→' }>; bestDayOfWeek: string | null; worstDayOfWeek: string | null; totalDays: number };

const TODAY_DOW_IDX = (new Date().getDay() + 6) % 7; // 0=пн ... 6=вс

interface Props {
  onOpenSettings?: () => void;
  onOpenTracker?: () => void;
  refreshKey?: number;
  displayName?: string | null;
}

export function ProfileSection({ onOpenSettings, onOpenTracker, refreshKey, displayName }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const firstName = displayName || '';

  const [streak, setStreak]             = useState<StreakData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [insights, setInsights]         = useState<InsightsData | null>(null);
  const [ready, setReady]               = useState(false);
  const [activeDates, setActiveDates]   = useState<Set<string>>(new Set());

  const [notesCount, setNotesCount] = useState<{ schema: number; mode: number } | null>(null);
  const [schemaNoteIds, setSchemaNotesIds] = useState<string[]>([]);
  const [modeNoteIds, setModeNoteIds] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(null);
  const [_insightsOpen] = useState(false); // kept for future use
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);
  const [_homeScreenStatus] = useState<string | null>(null);

  // Therapist relation
  const [relation, setRelation] = useState<TherapyRelationInfo | null>(null);

  // Progress stats
  const [diaryCount, setDiaryCount] = useState<number>(0);
  const [ysqCount, setYsqCount] = useState<number>(0);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setReady(false);
    setStreak(null);
    setAchievements(null);
    setInsights(null);
    Promise.all([
      api.getStreak().then(setStreak).catch(() => {}),
      api.getAchievements().then(setAchievements).catch(() => {}),
      api.getInsights().then(setInsights).catch(() => {}),
      Promise.all([api.getSchemaNotes(), api.getModeNotes()])
        .then(([sn, mn]) => {
          setNotesCount({ schema: sn.length, mode: mn.length });
          setSchemaNotesIds(sn.map(n => n.schemaId));
          setModeNoteIds(mn.map(n => n.modeId));
        })
        .catch(() => {}),
      api.history(112).then(h => setActiveDates(new Set(h.map(d => d.date)))).catch(() => {}),
      api.getTherapyRelation().then(r => setRelation(r)).catch(() => {}),
      Promise.all([
        api.getSchemaDiary().catch(() => []),
        api.getModeDiary().catch(() => []),
        api.getGratitudeDiary().catch(() => []),
      ]).then(([sd, md, gd]) => setDiaryCount(sd.length + md.length + gd.length)).catch(() => {}),
      api.getYsqHistory().then(h => setYsqCount(h.length)).catch(() => {}),
    ]).finally(() => setReady(true));
  }, [refreshKey]);

  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const totalDays     = streak?.totalDays ?? 0;
  const todayDone     = streak?.todayDone ?? false;
  const weekDots      = streak?.weekDots ?? [];
  const earnedList    = achievements?.filter(a => a.earned) ?? [];
  const hasInsights   = insights && insights.weeklyStats.some(s => s.avg !== null);


  return (
    <div className="page-inner-wide">

      {/* ── Хедер ── */}
      <div style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          <span style={{ color: 'var(--accent)' }}>● </span>Профиль
        </div>
        <h1 className="hub-title" style={{ marginBottom: 10 }}>
          {firstName || 'Мой'}<br /><span className="it">прогресс</span>
        </h1>
        {totalDays > 0 && (
          <div style={{ fontSize: 15, color: 'var(--text-sub)' }}>
            {totalDays} {totalDays === 1 ? 'день' : totalDays < 5 ? 'дня' : 'дней'} в приложении
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720 }}>

        {/* ── Скелетон ── */}
        {!ready && (
          <>
            {[110, 80, 72].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 20, background: 'linear-gradient(90deg,rgba(var(--fg-rgb),0.03) 25%,rgba(var(--fg-rgb),0.07) 50%,rgba(var(--fg-rgb),0.03) 75%)', backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite' }} />
            ))}
          </>
        )}

        {/* ── Прогресс ── */}
        {ready && (
          <div className="section">
            <div className="section-head"><h3>Прогресс</h3></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 36, flexWrap: 'wrap' }}>
              {[
                [currentStreak, 'дней стрика'],
                [totalDays, 'дней всего'],
                [diaryCount, 'записей дневника'],
                [ysqCount, 'прохождений теста'],
              ].map(([n, l]) => (
                <div key={l as string}>
                  <div className="num" style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--text)' }}>{n as number}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{l as string}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Стрик ── */}
        {ready && streak !== null && (
          <div className="section">
            <div className="section-head"><h3>Стрик</h3></div>
            {/* Top row: big number + secondary stats */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-3px',
                  color: currentStreak > 0
                    ? (todayDone ? 'var(--accent)' : 'var(--text)')
                    : 'rgba(var(--fg-rgb),0.2)',
                }}>
                  {currentStreak > 0 ? currentStreak : '–'}
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: currentStreak > 0 ? 'var(--text-sub)' : 'rgba(var(--fg-rgb),0.35)', lineHeight: 1.2 }}>
                    {currentStreak > 0
                      ? (currentStreak === 1 ? 'день\nподряд' : currentStreak < 5 ? 'дня\nподряд' : 'дней\nподряд')
                      : totalDays === 0 ? 'пока\nне начато' : 'серия\nпрервалась'}
                  </div>
                </div>
              </div>

              {/* Secondary stats */}
              <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
                {longestStreak > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{longestStreak}</div>
                    <div className="eyebrow" style={{ marginTop: 3 }}>рекорд</div>
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{totalDays}</div>
                  <div className="eyebrow" style={{ marginTop: 3 }}>всего</div>
                </div>
              </div>
            </div>

            {/* Week bars */}
            {weekDots.length > 0 && (
              <div style={{ display: 'flex', gap: 5 }}>
                {weekDots.map((done, i) => {
                  const isToday = i === TODAY_DOW_IDX;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: '100%', height: 5, borderRadius: 3,
                        background: done
                          ? (isToday ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 60%, transparent)')
                          : 'rgba(var(--fg-rgb),0.08)',
                        boxShadow: done && isToday ? '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none',
                      }} />
                      <div style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.25)', fontWeight: isToday ? 700 : 400 }}>
                        {DOW[i]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CTA to fill today (streak broken) */}
            {currentStreak === 0 && totalDays > 0 && onOpenTracker && (
              <button onClick={onOpenTracker} style={{ marginTop: 14, width: '100%', padding: '10px 0', border: 'none', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--text-sub)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Заполнить сегодня →
              </button>
            )}
          </div>
        )}


        {/* ── Activity heatmap ── */}
        {ready && activeDates.size > 0 && (() => {
          const WEEKS = 16;
          const today = new Date();
          const todayDow = (today.getDay() + 6) % 7;
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - todayDow - (WEEKS - 1) * 7);

          const weeks: { date: Date; dateStr: string }[][] = [];
          const cur = new Date(startDate);
          for (let w = 0; w < WEEKS; w++) {
            const week: { date: Date; dateStr: string }[] = [];
            for (let d = 0; d < 7; d++) {
              const dateStr = cur.toISOString().slice(0, 10);
              week.push({ date: new Date(cur), dateStr });
              cur.setDate(cur.getDate() + 1);
            }
            weeks.push(week);
          }

          const MONTH_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

          return (
            <div className="section">
              <div className="section-head"><h3>Активность</h3></div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 16 }}>
                    {['пн','','ср','','пт','','вс'].map((d, i) => (
                      <div key={i} style={{ height: 10, fontSize: 8, color: 'var(--text-faint)', lineHeight: '10px', width: 14, textAlign: 'right', paddingRight: 3 }}>{d}</div>
                    ))}
                  </div>
                  {weeks.map((week, wi) => {
                    const firstOfMonth = week.find(c => c.date.getDate() <= 7 && c.date.getDay() === 1);
                    const monthLabel = firstOfMonth ? MONTH_RU[firstOfMonth.date.getMonth()] : '';
                    return (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 13, fontSize: 8, color: 'var(--text-faint)', lineHeight: '13px', whiteSpace: 'nowrap' }}>{monthLabel}</div>
                        {week.map(({ dateStr, date }) => {
                          const isActive = activeDates.has(dateStr);
                          const isFuture = date > today;
                          return (
                            <div key={dateStr} style={{
                              width: 10, height: 10, borderRadius: 3,
                              background: isFuture ? 'transparent' : isActive ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.07)',
                              opacity: isFuture ? 0 : 1,
                            }} />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>меньше</span>
                {[0, 0.35, 0.65, 1].map((o, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: 3, background: i === 0 ? 'rgba(var(--fg-rgb),0.07)' : `color-mix(in srgb, var(--accent) ${Math.round(o * 100)}%, transparent)` }} />
                ))}
                <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>больше</span>
              </div>
            </div>
          );
        })()}

        {/* ── Достижения ── */}
        {ready && achievements && (
          <div onClick={() => setShowAchievements(true)} className="section" style={{ cursor: 'pointer', overflow: 'hidden' }}>
            <div className="section-head">
              <h3>Достижения</h3>
              <span className="hint">{earnedList.length} из {achievements.length} →</span>
            </div>

            {earnedList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-sub)', paddingRight: 16 }}>Первое – за первую запись в дневник</div>
            ) : (
              /* Horizontal scroll of earned achievements */
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingRight: 16, paddingBottom: 2 }}>
                {earnedList.map(a => {
                  const m = ACHIEVEMENT_META[a.id];
                  if (!m) return null;
                  return (
                    <div key={a.id} style={{
                      flexShrink: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '10px 12px',
                      borderRadius: 14,
                      background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                      minWidth: 64,
                    }}>
                      <span style={{ fontSize: 26 }}>{m.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{m.title}</span>
                    </div>
                  );
                })}
                {/* Locked preview */}
                {achievements.filter(a => !a.earned).length > 0 && (
                  <div style={{
                    flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(var(--fg-rgb),0.04)',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                    minWidth: 64,
                  }}>
                    <span style={{ fontSize: 20, opacity: 0.25 }}>🔒</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      ещё {achievements.filter(a => !a.earned).length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Паттерны (инсайты) ── */}
        {ready && hasInsights && (
          <div className="section">
            <div className="section-head"><h3>Паттерны</h3></div>

            {/* Best / worst day pills */}
            {((insights?.bestDayOfWeek || insights?.worstDayOfWeek) && (insights?.totalDays ?? 0) >= 7) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {insights?.bestDayOfWeek && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent-yellow) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)' }}>
                    <span style={{ fontSize: 13 }}>☀️</span>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 1 }}>лучший день</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-yellow)' }}>{insights.bestDayOfWeek}</div>
                    </div>
                    <span onClick={e => { e.stopPropagation(); setShowBestDayInfo(true); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text-sub)', fontSize: 8, fontWeight: 600, cursor: 'pointer', marginLeft: 2 }}>?</span>
                  </div>
                )}
                {insights?.worstDayOfWeek && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)' }}>
                    <span style={{ fontSize: 13 }}>🌧</span>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 1 }}>тяжелее</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{insights.worstDayOfWeek}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Need bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {insights?.weeklyStats.filter(s => s.avg !== null).map(s => {
                const isUp = s.trend === '↑';
                const isDown = s.trend === '↓';
                const barColor = isUp ? 'var(--accent-green)' : isDown ? 'var(--accent-red)' : 'var(--accent)';
                const barW = Math.round(((s.avg ?? 0) / 10) * 100);
                return (
                  <div key={s.needId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{NEED_NAMES[s.needId]}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{(s.avg ?? 0).toFixed(1)} <span style={{ fontSize: 11 }}>{s.trend}</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(var(--fg-rgb),0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${barW}%`, background: barColor, opacity: 0.7, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Мои записи ── */}
        {ready && notesCount !== null && (
          <div onClick={() => setNotesOpen(true)} className="section" style={{ cursor: 'pointer' }}>
            <div className="section-head">
              <h3>Мои записи</h3>
              <span className="hint">→</span>
            </div>

            {notesCount.schema + notesCount.mode === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Личные карточки схем и режимов</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {schemaNoteIds.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>🧩 Схемы</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {schemaNoteIds.map(id => {
                        const schema = ALL_SCHEMAS.find(s => s.id === id);
                        return (
                          <span key={id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', fontWeight: 500 }}>
                            {schema?.name ?? id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {modeNoteIds.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>🔄 Режимы</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {modeNoteIds.map(id => {
                        const mode = ALL_MODES.find(m => m.id === id);
                        return (
                          <span key={id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)', color: 'var(--accent-blue)', fontWeight: 500 }}>
                            {mode?.name ?? id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Терапевт ── */}
        {relation?.role === 'client' && relation.partnerName && (
          <div className="section">
            <div className="section-head"><h3>Терапевт</h3></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{relation.partnerName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 16 }}>Схема-терапевт</div>
            {[
              relation.nextSession ? ['Следующая сессия', (() => {
                const [datePart, timePart] = relation.nextSession!.includes('T') ? relation.nextSession!.split('T') : [relation.nextSession!, null];
                const [y, m, d] = datePart.split('-').map(Number);
                const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
                const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
                const date = new Date(y, m - 1, d);
                return `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}${timePart ? ' · ' + timePart : ''}`;
              })()] : null,
            ].filter((x): x is string[] => x !== null).map(([k, v]) => (
              <div key={k as string} className="list-line">
                <span style={{ fontSize: 13, color: 'var(--text-sub)', width: 180, flexShrink: 0 }}>{k as string}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{v as string}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <TherapyNote compact />
        </div>

        {/* ── Настройки и аккаунт (только мобайл, на десктопе есть в сайдбаре) ── */}
        <div className="mobile-only section" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            >
              <span>Настройки</span>
              <span style={{ color: 'var(--text-sub)', fontSize: 18 }}>›</span>
            </button>
          )}
          <button
            onClick={() => navigate('/account')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>Аккаунт и привязки</span>
            <span style={{ color: 'var(--text-sub)', fontSize: 18 }}>›</span>
          </button>
          <button
            onClick={() => logout()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--c-rose)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>Выйти</span>
          </button>
        </div>

        {/* ── Удаление аккаунта – discreet link ── */}
        <div style={{ marginTop: 8, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          <span
            className="link"
            style={{ color: 'var(--c-rose)', cursor: 'pointer', fontSize: 13 }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Удалить аккаунт
          </span>
        </div>
      </div>

      {/* ── Достижения ── */}
      {showAchievements && achievements && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setShowAchievements(false); setSelectedAchievement(null); }}
        >
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 12, padding: '28px 28px 32px', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Достижения</span>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{earnedList.length} из {achievements.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {achievements.map(a => {
                const m = ACHIEVEMENT_META[a.id];
                if (!m) return null;
                const progress = !a.earned ? (() => {
                  switch (a.id) {
                    case 'streak_3':   return currentStreak > 0 ? `${currentStreak}/3` : null;
                    case 'streak_7':   return currentStreak > 0 ? `${currentStreak}/7` : null;
                    case 'streak_14':  return currentStreak > 0 ? `${currentStreak}/14` : null;
                    case 'streak_30':  return currentStreak > 0 ? `${currentStreak}/30` : null;
                    case 'streak_100': return currentStreak > 0 ? `${currentStreak}/100` : null;
                    case 'total_10':   return totalDays > 0 ? `${totalDays}/10` : null;
                    case 'total_50':   return totalDays > 0 ? `${totalDays}/50` : null;
                    default: return null;
                  }
                })() : null;
                return (
                  <div
                    key={a.id}
                    onClick={() => a.earned && setSelectedAchievement(a.id)}
                    style={{
                      background: a.earned ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                      border: `1px solid ${a.earned ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'rgba(var(--fg-rgb),0.06)'}`,
                      borderRadius: 16, padding: '14px 10px 12px',
                      textAlign: 'center',
                      cursor: a.earned ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 6, filter: a.earned ? 'none' : 'grayscale(1) opacity(0.25)' }}>{m.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: a.earned ? 'var(--text)' : 'var(--text-faint)', marginBottom: 3, lineHeight: 1.3 }}>{m.title}</div>
                    {progress
                      ? <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{progress}</div>
                      : <div style={{ fontSize: 10, color: a.earned ? 'var(--text-sub)' : 'var(--text-faint)', opacity: a.earned ? 1 : 0.5, lineHeight: 1.4 }}>{m.desc}</div>
                    }
                  </div>
                );
              })}
            </div>
        </div>
        </div>
      )}

      {/* Achievement detail overlay */}
      {selectedAchievement && (() => {
        const m = ACHIEVEMENT_META[selectedAchievement];
        if (!m) return null;
        return (
          <div onClick={() => setSelectedAchievement(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, animation: 'fade-in 0.18s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sheet-bg)', borderRadius: 28, padding: '36px 28px 28px', width: '100%', maxWidth: 320, textAlign: 'center', animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{m.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{m.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 28 }}>{m.desc}</div>
              <button onClick={async () => {
                const text = `${m.emoji} Получил достижение «${m.title}»!\n\nt.me/SchemaLabBot`;
                try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch {}
              }} className="btn-primary">
                Поделиться
              </button>
            </div>
          </div>
        );
      })()}

      {/* Best day tooltip */}
      {showBestDayInfo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowBestDayInfo(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 400, border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Лучший день</div>
            <p style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7, marginBottom: 14 }}>{tr('День недели, в который твои оценки в среднем выше всего.', 'День недели, в который ваши оценки в среднем выше всего.')}</p>
            <p style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7 }}>Становится точнее с каждой неделей.</p>
          </div>
        </div>
      )}

      {notesOpen && <MyNotesSheet onClose={() => setNotesOpen(false)} />}

      {/* Delete account confirm */}
      {showDeleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 12, padding: '28px 28px 32px', width: '100%', maxWidth: 420, border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Удалить аккаунт?</div>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 24 }}>
              Все данные будут удалены безвозвратно: дневники, записи, прогресс, настройки. Восстановить невозможно.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setDeleting(true);
                  api.deleteAllUserData()
                    .then(() => { window.location.reload(); })
                    .catch(() => { setDeleting(false); });
                }}
                disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 14, border: 'none', background: 'var(--c-rose)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
