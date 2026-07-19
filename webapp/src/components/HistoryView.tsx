import { useState, useCallback, useEffect, useRef } from 'react';
import { useTr } from '../utils/addressForm';
import { COLORS } from '../types';
import type { Need, DayHistory } from '../types';
import { NeedHistorySheet } from './NeedHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { IndexInfoSheet } from './IndexInfoSheet';
import { NoteSheet } from './NoteSheet';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { api } from '../api';

interface Props {
  needs: Need[];
  history: DayHistory[];
  currentRatings: Record<string, number>;
  childhoodRatings?: Partial<Record<string, number>>;
  onOpenSchemas?: () => void;
  onOpenChildhoodWheel?: () => void;
  days?: number;
  onChangeDays?: (days: number) => void;
  onGoToToday?: () => void;
  onBackfill?: (date: string) => void;
}

const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const TODAY_STR = new Date().toISOString().split('T')[0];
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const HISTORY_HINT_KEY = 'history_hint_dismissed';
const DAYS_OPTIONS = [7, 14, 30];

function getDayAbbr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DOW_SHORT[new Date(y, m - 1, d).getDay()];
}
function getDayNum(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2]));
}
function dayAvg(day: DayHistory, needs: Need[]): number | null {
  const vals = needs.map(n => day.ratings[n.id] ?? 0).filter(v => v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// ─── Wheel ────────────────────────────────────────────────────────────────────

function petalPath(cx: number, cy: number, r: number, ca: number, hs: number): string {
  if (r < 1) return '';
  const a1 = ca - hs, a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function arcPath2(cx: number, cy: number, r: number, ca: number, hs: number): string {
  const a1 = ca - hs, a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function NeedsWheel({ needs, ratings, prevRatings = {}, childhoodRatings = {}, onClickNeed, onClickCenter }: {
  needs: Need[]; ratings: Record<string, number>; prevRatings?: Record<string, number>;
  childhoodRatings?: Partial<Record<string, number>>;
  onClickNeed?: (n: Need) => void; onClickCenter?: () => void;
}) {
  const W = 360, H = 280, cx = W / 2, cy = H / 2, R = cy - 20;
  const SPREAD = (34 * Math.PI) / 180, n = needs.length, CENTER_R = 41;
  const avg = n > 0 ? needs.reduce((s, nd) => s + (ratings[nd.id] ?? 0), 0) / n : 0;
  const prevAvg = Object.keys(prevRatings).length > 0
    ? needs.reduce((s, nd) => s + (prevRatings[nd.id] ?? 0), 0) / n : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 280 }}>
      {[2, 5, 8, 10].map(ring => (
        <circle key={ring} cx={cx} cy={cy} r={R * ring / 10}
          fill="none" stroke="rgba(var(--fg-rgb),0.04)" strokeWidth={ring === 10 ? 1.5 : 1} />
      ))}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const d = petalPath(cx, cy, R, angle, SPREAD);
        return d ? <path key={`g-${need.id}`} d={d} fill="rgba(var(--fg-rgb),0.055)" /> : null;
      })}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const value = ratings[need.id] ?? 0;
        const r = Math.sqrt(value / 10) * R;
        const color = COLORS[need.id] ?? '#888';
        const d = petalPath(cx, cy, r, angle, SPREAD);
        return d ? <path key={need.id} d={d} fill={color} fillOpacity={0.9}
          stroke={color} strokeWidth={1} strokeOpacity={0.4} strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px`, animation: `sector-in 400ms ${SPRING} ${i * 80}ms both` }} /> : null;
      })}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [0.25, 0.5, 0.75].map(frac => (
          <path key={`a-${need.id}-${frac}`} d={arcPath2(cx, cy, R * frac, angle, SPREAD)}
            fill="none" stroke="rgba(var(--fg-rgb),0.1)" strokeWidth={1} />
        ));
      })}
      {Object.keys(childhoodRatings).length > 0 && needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const r = Math.sqrt((childhoodRatings[need.id] ?? 0) / 10) * R;
        const d = petalPath(cx, cy, r, angle, SPREAD);
        return d ? <path key={`c-${need.id}`} d={d} fill="none"
          stroke="rgba(var(--fg-rgb),0.4)" strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" /> : null;
      })}
      <circle cx={cx} cy={cy} r={CENTER_R} fill="var(--bg)" stroke="rgba(var(--fg-rgb),0.05)" strokeWidth={1} />
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize={11} fill="rgba(var(--fg-rgb),0.4)">индекс</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={32} fontWeight={700} fill="var(--text)">{avg.toFixed(1)}</text>
      {prevAvg !== null && prevAvg > 0 && (
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize={11} fill="rgba(var(--fg-rgb),0.35)">
          {avg >= prevAvg ? '↑' : '↓'} вчера {prevAvg.toFixed(1)}
        </text>
      )}
      {onClickNeed && needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const d = petalPath(cx, cy, R, angle, SPREAD);
        return d ? <path key={`h-${need.id}`} d={d} fill="transparent"
          onClick={() => onClickNeed(need)} style={{ cursor: 'pointer' }} /> : null;
      })}
      {onClickCenter && <circle cx={cx} cy={cy} r={CENTER_R} fill="transparent"
        onClick={onClickCenter} style={{ cursor: 'pointer' }} />}
    </svg>
  );
}

// ─── Sparkline row ────────────────────────────────────────────────────────────

function SparklineRow({ need, history, selectedIdx, selectedRatings, onClick }: {
  need: Need; history: DayHistory[]; selectedIdx: number;
  selectedRatings: Record<string, number>; onClick?: () => void;
}) {
  const color = COLORS[need.id] ?? '#888';
  const W = 100, H = 28;
  const reversed = [...history].reverse();
  const n = reversed.length;
  const xStep = n > 1 ? W / (n - 1) : W / 2;
  const yFor = (v: number) => v === 0 ? H - 1 : 25 - ((Math.min(v, 10) - 1) / 9) * 23;
  const pts = reversed.map((day, i) => ({ x: i * xStep, y: yFor(day.ratings[need.id] ?? 0) }));
  const dotIdx = Math.max(0, Math.min(n - 1 - selectedIdx, n - 1));
  const dot = pts[dotIdx];
  const score = selectedRatings[need.id] ?? 0;
  const prevScore = history[selectedIdx + 1]?.ratings[need.id] ?? score;
  const delta = score - prevScore;
  const trendColor = delta > 0 ? 'var(--accent-green)' : delta < 0 ? 'var(--accent-red)' : 'var(--text-faint)';
  const trendArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–';
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[n - 1].x.toFixed(1)} ${H} L 0 ${H} Z`;
  const polyStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 0', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', width: 100, flexShrink: 0 }}>{need.chartLabel}</span>
      <svg style={{ flex: 1, height: 28, display: 'block', overflow: 'visible' }}
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`ag-${need.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#ag-${need.id})`} />
        <polyline points={polyStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={dot.x} cy={dot.y} r={3.5} fill={color} style={{ transition: 'cx 150ms ease, cy 150ms ease' }} />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color, minWidth: 20, textAlign: 'right' }}>{score || '–'}</span>
        {score > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: trendColor }}>{trendArrow}</span>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HistoryView({ needs, history, currentRatings, childhoodRatings = {}, onOpenSchemas, onOpenChildhoodWheel, days = 7, onChangeDays, onGoToToday, onBackfill }: Props) {
  const tr = useTr();
  const contact = getTherapistContact();
  // Терапевту не предлагаем запись к самому себе (null); один элемент на оба блока.
  const bookingLink = contact.isTherapist ? null : (
    <a href={contact.bookingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Записаться →</a>
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subView, setSubView] = useState<'day' | 'week'>('day');
  const dateBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [showWeekCard, setShowWeekCard] = useState(false);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(HISTORY_HINT_KEY));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
    if (history.length > 0 && selectedIdx >= history.length) setSelectedIdx(history.length - 1);
  }, [history.length, selectedIdx]);

  useEffect(() => {
    dateBtnRefs.current[selectedIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIdx]);

  useEffect(() => {
    if (history.length === 0) return;
    const date = history[selectedIdx]?.date;
    if (date) api.getNote(date).then(r => { setNoteText(r.text); setNoteTags(r.tags ?? []); });
  }, [selectedIdx, history]);

  const handleTapNeed = useCallback((n: Need) => {
    if (showHint) { localStorage.setItem(HISTORY_HINT_KEY, '1'); setShowHint(false); }
    setActiveNeed(n);
  }, [showHint]);

  if (history.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text-sub)', marginBottom: 12, fontStyle: 'italic' }}>Пусто.</div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 28 }}>
          {tr('Заполни трекер сегодня – через 3–5 дней начнёт проявляться паттерн', 'Заполните трекер сегодня – через 3–5 дней начнёт проявляться паттерн')}
        </div>
        {onGoToToday && (
          <button onClick={onGoToToday} className="btn-primary" style={{ maxWidth: 280, margin: '0 auto' }}>
            Заполнить сегодня
          </button>
        )}
      </div>
    );
  }

  const selected = history[selectedIdx] ?? history[0];
  const selectedRatings = selected.date === TODAY_STR ? currentRatings : selected.ratings;
  const prevRatings = history[selectedIdx + 1]?.ratings ?? {};
  const ratedCount = Object.keys(selectedRatings).filter(k => (selectedRatings[k] ?? 0) > 0).length;
  const needsLow = history.length >= 3
    ? needs.filter(n => history.slice(0, 3).every(d => (d.ratings[n.id] ?? 10) <= 4)) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Date strip ── */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {history.map((day, i) => {
            const active = i === selectedIdx;
            const avg = dayAvg(day, needs);
            const barColor = avg === null ? 'transparent'
              : avg >= 7 ? 'var(--accent-green)' : avg >= 4 ? 'var(--accent-yellow)' : 'var(--accent-red)';

            return (
              <button key={day.date}
                ref={el => { dateBtnRefs.current[i] = el; }}
                onClick={() => setSelectedIdx(i)}
                style={{
                  flexShrink: 0, width: 44, padding: '7px 0 9px', border: 'none', borderRadius: 12,
                  fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center',
                  background: active ? 'var(--text)' : 'rgba(var(--fg-rgb),0.05)',
                  transition: 'all 0.15s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
                  color: active ? 'rgba(var(--bg-rgb, 255,255,255),0.6)' : 'var(--text-faint)',
                  textTransform: 'uppercase',
                }}>{getDayAbbr(day.date)}</span>
                <span style={{
                  fontSize: 16, fontWeight: 700, lineHeight: 1,
                  color: active ? 'var(--bg)' : 'var(--text)',
                }}>{getDayNum(day.date)}</span>
                <div style={{ width: 20, height: 3, borderRadius: 2, background: active ? 'rgba(255,255,255,0.35)' : 'rgba(var(--fg-rgb),0.07)', overflow: 'hidden' }}>
                  {avg !== null && (
                    <div style={{ width: `${Math.round((avg / 10) * 100)}%`, height: '100%', background: active ? 'rgba(255,255,255,0.8)' : barColor, borderRadius: 2 }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Subview toggle + depth ── */}
      <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', background: 'rgba(var(--fg-rgb),0.06)', borderRadius: 10, padding: 3 }}>
          {(['day', 'week'] as const).map(v => {
            const active = subView === v;
            return (
              <button key={v} onClick={() => setSubView(v)} style={{
                padding: '6px 14px', border: 'none', borderRadius: 8, fontFamily: 'inherit',
                background: active ? 'var(--text)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--text-faint)',
                fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                {v === 'day' ? 'День' : 'Неделя'}
              </button>
            );
          })}
        </div>

        {onChangeDays && (
          <div style={{ display: 'flex', background: 'rgba(var(--fg-rgb),0.06)', borderRadius: 10, padding: 3 }}>
            {DAYS_OPTIONS.map(d => {
              const active = days === d;
              return (
                <button key={d} onClick={() => onChangeDays(d)} style={{
                  padding: '6px 10px', border: 'none', borderRadius: 8, fontFamily: 'inherit',
                  background: active ? 'var(--text)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--text-faint)',
                  fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                }}>{d}д</button>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />
        {showHint && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            нажми на потребность
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div key={subView} style={{ animation: 'fade-in 200ms ease' }}>

        {subView === 'day' ? (
          <div style={{ padding: '0 20px' }}>

            {/* Wheel – no card, just space */}
            <div style={{ marginBottom: 8 }} key={selected.date}>
              <NeedsWheel needs={needs} ratings={selectedRatings} prevRatings={prevRatings}
                childhoodRatings={childhoodRatings}
                onClickNeed={handleTapNeed} onClickCenter={() => setShowIndexInfo(true)} />
            </div>

            {/* Links row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}>
              {Object.keys(childhoodRatings).length > 0 ? (
                <button onClick={onOpenChildhoodWheel} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: 0 }}>
                  <svg width={16} height={6}><line x1={0} y1={3} x2={16} y2={3} stroke="rgba(var(--fg-rgb),0.3)" strokeWidth={1.5} strokeDasharray="3 3" /></svg>
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>детство</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>→</span>
                </button>
              ) : onOpenChildhoodWheel ? (
                <button onClick={onOpenChildhoodWheel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>🌱 Оценить детство →</span>
                </button>
              ) : null}
              {onOpenSchemas && (
                <button onClick={onOpenSchemas} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>Что за этим стоит →</span>
                </button>
              )}
            </div>

            {/* Backfill */}
            {onBackfill && selected.date !== TODAY_STR && (
              <div onClick={() => onBackfill(selected.date)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBackfill(selected.date); } }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', marginBottom: 8, cursor: 'pointer',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ratedCount === 0 ? 'var(--text)' : 'var(--text-sub)' }}>
                    {ratedCount === 0 ? 'Заполнить этот день' : `Дополнить оценки`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                    {ratedCount === 0 ? 'Оценки не заполнены' : `Заполнено ${ratedCount} из ${needs.length}`}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>→</span>
              </div>
            )}

            {/* Need rows – list-line style */}
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
              {needs.map((n, i) => {
                const val = selectedRatings[n.id] ?? 0;
                const color = COLORS[n.id] ?? '#888';
                const levelLabel = val === 0 ? '' : val <= 3 ? 'низко' : val <= 6 ? 'средне' : 'хорошо';
                const levelColor = val <= 3 ? 'var(--accent-red)' : val <= 6 ? 'var(--accent-yellow)' : 'var(--accent-green)';
                return (
                  <div key={n.id} onClick={() => handleTapNeed(n)} role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTapNeed(n); } }} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 0',
                    borderBottom: i < needs.length - 1 ? '1px solid rgba(var(--fg-rgb),0.07)' : 'none',
                    cursor: 'pointer',
                  }}>
                    <div style={{ width: 3, height: 32, borderRadius: 2, background: val > 0 ? color : 'rgba(var(--fg-rgb),0.1)', flexShrink: 0 }} />
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{n.emoji}</span>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', fontWeight: 400 }}>{n.chartLabel}</span>
                    {val > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: levelColor }}>{levelLabel}</span>
                    )}
                    <span style={{
                      fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400,
                      color: val > 0 ? color : 'var(--text-faint)',
                      minWidth: 28, textAlign: 'right',
                    }}>
                      {val > 0 ? val : '–'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Low need insight */}
            {needsLow.length > 0 && (() => {
              const low = needsLow[0];
              const color = COLORS[low.id] ?? '#888';
              return (
                <div style={{
                  marginTop: 20, padding: '16px 0',
                  borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
                }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Стоит уделить внимание</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{low.chartLabel}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                        Остаётся низкой несколько дней подряд.{!contact.isTherapist && ' Терапевт поможет разобраться.'}
                      </div>
                    </div>
                  </div>
                  {bookingLink}
                </div>
              );
            })()}

            {/* Note */}
            <div onClick={() => setShowNote(true)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowNote(true); } }} style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              padding: '14px 0', marginTop: 4,
              borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
            }}>
              <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>📝</span>
              <span style={{ fontSize: 13, color: noteText ? 'var(--text-sub)' : 'var(--text-faint)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: noteText ? 'normal' : 'italic' }}>
                {noteText || 'Добавить заметку к этому дню'}
              </span>
              {noteText && <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>›</span>}
            </div>
            {noteTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
                {noteTags.map(tag => (
                  <span key={tag} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                    background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)',
                  }}>{tag}</span>
                ))}
              </div>
            )}

            {history.length < 3 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-faint)', padding: '16px 0', fontStyle: 'italic' }}>
                Ещё {3 - history.length} {3 - history.length === 1 ? 'день' : 'дня'} – и паттерн начнёт проявляться
              </div>
            )}
          </div>

        ) : (
          /* ── Неделя ── */
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              За {days} дней
            </div>
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
              {needs.map((need, i) => (
                <div key={need.id} style={{ borderBottom: i < needs.length - 1 ? '1px solid rgba(var(--fg-rgb),0.07)' : 'none' }}>
                  <SparklineRow need={need} history={history}
                    selectedIdx={selectedIdx} selectedRatings={selectedRatings}
                    onClick={() => handleTapNeed(need)} />
                </div>
              ))}
            </div>

            {needsLow.length > 0 && (
              <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text)' }}>{needsLow[0].chartLabel}</strong> остаётся низкой несколько дней{!contact.isTherapist && ' – разобраться рядом с живым человеком бывает легче'}.
                </div>
                {bookingLink}
              </div>
            )}

            <button onClick={() => setShowWeekCard(true)} style={{
              marginTop: 20, padding: '13px 0', border: '1px solid rgba(var(--fg-rgb),0.1)',
              borderRadius: 12, background: 'transparent', fontFamily: 'inherit',
              color: 'var(--text-sub)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Карточка недели →
            </button>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      {showNote && history[selectedIdx] && (
        <NoteSheet date={history[selectedIdx].date} onClose={() => {
          api.getNote(history[selectedIdx].date).then(r => { setNoteText(r.text); setNoteTags(r.tags ?? []); });
          setShowNote(false);
        }} />
      )}
      {showIndexInfo && <IndexInfoSheet onClose={() => setShowIndexInfo(false)} />}
      {showWeekCard && (
        <WeeklyCardSheet needs={needs} history={history.slice(0, 7)} onClose={() => setShowWeekCard(false)} />
      )}
      {activeNeed && (
        <NeedHistorySheet need={activeNeed} value={selectedRatings[activeNeed.id] ?? 0}
          history={history} childhoodValue={childhoodRatings[activeNeed.id]}
          onClose={() => setActiveNeed(null)} />
      )}
    </div>
  );
}
