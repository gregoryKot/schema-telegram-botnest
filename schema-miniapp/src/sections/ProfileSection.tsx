import { useEffect, useState } from 'react';
import { api, Achievement } from '../api';
import { useSafeTop } from '../utils/safezone';
import { BottomSheet } from '../components/BottomSheet';
import { TherapyNote } from '../components/TherapyNote';
import { MyNotesSheet } from '../components/MyNotesSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';

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
  onOpenSettings: () => void;
  onOpenTracker?: () => void;
  refreshKey?: number;
  displayName?: string | null;
}

export function ProfileSection({ onOpenSettings, onOpenTracker, refreshKey, displayName }: Props) {
  const safeTop = useSafeTop();
  const tgName = (window.Telegram?.WebApp as any)?.initDataUnsafe?.user?.first_name ?? '';
  const firstName = displayName || tgName;

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
  const [insightsOpen] = useState(false); // kept for future use
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);
  const [homeScreenStatus] = useState<string | null>(null);

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
    ]).finally(() => setReady(true));
  }, [refreshKey]);

  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const totalDays     = streak?.totalDays ?? 0;
  const todayDone     = streak?.todayDone ?? false;
  const weekDots      = streak?.weekDots ?? [];
  const earnedList    = achievements?.filter(a => a.earned) ?? [];
  const hasInsights   = insights && insights.weeklyStats.some(s => s.avg !== null);

  const insightSummary = (() => {
    if (!insights) return null;
    if (insights.bestDayOfWeek && insights.totalDays >= 7) return `Лучший день — ${insights.bestDayOfWeek}`;
    const rising = insights.weeklyStats.find(s => s.trend === '↑');
    if (rising) return `${NEED_NAMES[rising.needId]} растёт`;
    return 'Заполняй дневник каждый день';
  })();

  const showHomeSuggestion = false; // moved to onboarding

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 140, paddingTop: safeTop, animation: 'fade-in 0.25s ease', overflowX: 'hidden' }}>

      {/* ── Хедер ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#fff',
          }}>
            {(firstName || 'Я')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
              {firstName || 'Я'}
            </div>
            {totalDays > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 1 }}>
                {totalDays} {totalDays === 1 ? 'день' : totalDays < 5 ? 'дня' : 'дней'} в приложении
              </div>
            )}
          </div>
        </div>
        <button onClick={onOpenSettings} style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--text-sub)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ⚙️
        </button>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Скелетон ── */}
        {!ready && (
          <>
            {[110, 80, 72].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 20, background: 'linear-gradient(90deg,rgba(var(--fg-rgb),0.03) 25%,rgba(var(--fg-rgb),0.07) 50%,rgba(var(--fg-rgb),0.03) 75%)', backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite' }} />
            ))}
          </>
        )}

        {/* ── Стрик ── */}
        {ready && streak !== null && (
          <div className="card" style={{ borderRadius: 20, padding: '20px 20px 18px' }}>
            {/* Top row: big number + secondary stats */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-3px',
                  color: currentStreak > 0
                    ? (todayDone ? 'var(--accent)' : 'var(--text)')
                    : 'rgba(var(--fg-rgb),0.2)',
                }}>
                  {currentStreak > 0 ? currentStreak : '—'}
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
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{longestStreak}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>рекорд</div>
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{totalDays}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>всего</div>
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
            <div className="card" style={{ borderRadius: 20, padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
                Активность
              </div>
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
          <div onClick={() => setShowAchievements(true)} className="card" style={{ borderRadius: 20, padding: '16px 0 16px 16px', cursor: 'pointer', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingRight: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Достижения
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{earnedList.length} из {achievements.length}</span>
                <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>›</span>
              </div>
            </div>

            {earnedList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-sub)', paddingRight: 16 }}>Первое — за первую запись в дневник</div>
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
          <div className="card" style={{ borderRadius: 20, padding: '16px 16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 14 }}>Паттерны</div>

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
          <div onClick={() => setNotesOpen(true)} className="card" style={{ borderRadius: 20, padding: '16px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Мои записи</div>
              <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>›</span>
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

        <div style={{ padding: '4px 0' }}>
          <TherapyNote compact />
        </div>
      </div>

      {/* ── BottomSheet: Достижения ── */}
      {showAchievements && achievements && (
        <BottomSheet onClose={() => { setShowAchievements(false); setSelectedAchievement(null); }}>
          <div style={{ paddingTop: 4 }}>
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
        </BottomSheet>
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
        <BottomSheet onClose={() => setShowBestDayInfo(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>Лучший день</div>
            <p style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7, marginBottom: 14 }}>День недели, в который твои оценки в среднем выше всего.</p>
            <p style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7 }}>Становится точнее с каждой неделей.</p>
          </div>
        </BottomSheet>
      )}

      {notesOpen && <MyNotesSheet onClose={() => setNotesOpen(false)} />}
    </div>
  );
}
