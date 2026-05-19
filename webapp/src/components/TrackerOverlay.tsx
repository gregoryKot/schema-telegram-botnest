// TrackerOverlay.tsx — Full tracker as standalone overlay
// Place at: src/components/TrackerOverlay.tsx (NEW FILE)
//
// This replaces the inline tracker code in App.tsx.
// Wire it up in App.tsx:
//   {showTracker && (
//     <TrackerOverlay
//       needs={needs} ratings={ratings} saved={saved}
//       onClose={() => { setShowTracker(false); setTrackerTab('today'); }}
//       initialNeedId={trackerNeedId}
//       onSaved={handleSaved} onChange={handleChange}
//       isOffline={isOffline}
//     />
//   )}

import { useState, useRef, useCallback, useEffect } from 'react';
import { COLORS, YESTERDAY } from '../types';
import type { Need } from '../types';
import { NEED_DATA } from '../needData';
import { NeedDial } from './NeedDial';
import { NeedTodaySheet } from './NeedTodaySheet';

import { api } from '../api';
import type { StreakData } from '../api';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  saved: Record<string, boolean>;
  isOffline?: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  onClose: () => void;
  initialNeedId?: string | null;
  onOpenNote?: () => void;
  onOpenGoal?: () => void;
  onOpenHistory?: () => void;
  yesterdayRatings?: Record<string, number>;
  /** When set, enables backfill mode: saves to this past date, loads existing ratings */
  date?: string;
  onDone?: () => void;
}

const ONBOARDING_KEY = 'tracker_onboarding_v1';
const ONBOARDING_STEPS = [
  { emoji: '👆', title: 'Оценивай действия',
    text: 'Не «я вроде чувствую», а конкретные моменты. Тап по дуге или +/−.' },
  { emoji: '💡', title: 'Нажми на название',
    text: 'Там вопрос для рефлексии, примеры и диапазоны оценки.' },
  { emoji: '📊', title: 'Паттерн — через 3–5 дней',
    text: 'Всё сохраняется. Динамика появится в разделе «История».' },
];

// ── Donut ring ─────────────────────────────────────────────────────────────────
function SummaryDonut({ avg }: { avg: number }) {
  const s = 52, r = 20, cx = 26, cy = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(avg / 10, 1));
  return (
    <svg width={s} height={s}>
      <defs>
        <linearGradient id="dg2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-pink)"/>
          <stop offset="50%" stopColor="var(--accent-yellow)"/>
          <stop offset="100%" stopColor="var(--accent-green)"/>
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth={5}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#dg2)" strokeWidth={5}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:'stroke-dashoffset 0.35s ease' }}/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontWeight={600} fill="var(--text)">{Math.round(avg/10*100)}%</text>
    </svg>
  );
}

export function TrackerOverlay({
  needs, ratings, saved: _saved, isOffline,
  onChange, onSaved, onClose, initialNeedId,
  onOpenNote, onOpenGoal: _onOpenGoal, onOpenHistory, yesterdayRatings = {},
  date, onDone,
}: Props) {
  const timers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const unlockTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Backfill mode: own ratings state loaded from API for the given date
  const isBackfill = !!date;
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const [localLoading, setLocalLoading] = useState(isBackfill);

  useEffect(() => {
    if (!isBackfill) return;
    api.ratings(date).then(r => setLocalRatings(r)).finally(() => setLocalLoading(false));
  }, [date, isBackfill]);

  const effectiveRatings = isBackfill ? localRatings : ratings;

  const [idx, setIdx] = useState(() => {
    if (initialNeedId) { const i = needs.findIndex(n => n.id === initialNeedId); if (i >= 0) return i; }
    if (!isBackfill) {
      const f = needs.findIndex(n => ratings[n.id] === undefined);
      return f >= 0 ? f : 0;
    }
    return 0;
  });
  const [_unlocked,   setUnlocked]    = useState<Set<string>>(new Set());
  const [detailNeed,  setDetailNeed]  = useState<Need | null>(null);
  const [onbStep,     setOnbStep]     = useState(0);
  const [showOnb,     setShowOnb]     = useState(() => !isBackfill && !localStorage.getItem(ONBOARDING_KEY));
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const need     = needs[idx];
  const value    = effectiveRatings[need.id] ?? 0;
  const allRated = needs.every(n => effectiveRatings[n.id] !== undefined && effectiveRatings[n.id] > 0);
  const avg      = needs.length > 0 ? needs.reduce((s,n)=>s+(effectiveRatings[n.id]??0),0)/needs.length : 0;
  const yval     = yesterdayRatings[need.id] ?? YESTERDAY[need.id];
  const delta    = (!isBackfill && value > 0 && yval !== undefined) ? value - yval : null;

  const dismissOnb = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnb(false);
  }, []);

  const handleChange = useCallback((needId: string, v: number) => {
    if (isBackfill) {
      setLocalRatings(prev => ({ ...prev, [needId]: v }));
      clearTimeout(timers.current[needId]);
      timers.current[needId] = setTimeout(async () => {
        if (v === 0) return;
        try { await api.saveRating(needId, v, date); setLastSavedAt(new Date()); } catch { /* offline */ }
      }, 500);
      return;
    }
    onChange(needId, v);
    if (isOffline) return;
    setUnlocked(p => new Set([...p, needId]));
    clearTimeout(unlockTimers.current[needId]);
    unlockTimers.current[needId] = setTimeout(() => {
      setUnlocked(p => { const n = new Set(p); n.delete(needId); return n; });
    }, 2500);
    clearTimeout(timers.current[needId]);
    timers.current[needId] = setTimeout(async () => {
      if (v === 0) return;
      try {
        const res = await api.saveRating(needId, v);
        onSaved(needId, res.allDone ? res.streak : undefined);
        setLastSavedAt(new Date());
      } catch { /* handle offline */ }
    }, 500);
  }, [onChange, onSaved, isOffline, isBackfill, date]);

  // Swipe between needs — high threshold to avoid accidental triggers
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTS(e: React.TouchEvent) { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  function onTE(e: React.TouchEvent) {
    if (touchRef.current === null || detailNeed) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    // Only swipe if clearly horizontal (dx much larger than dy) and long enough
    if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
    if (dx < 0 && idx < needs.length - 1) setIdx(idx + 1);
    if (dx > 0 && idx > 0) setIdx(idx - 1);
  }

  if (localLoading) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:80, background:'var(--bg)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:14, color:'var(--text-sub)' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'var(--bg)',
      display:'flex', flexDirection:'column' }}
      onTouchStart={onTS} onTouchEnd={onTE}>

      {/* Header */}
      <div style={{ padding:`16px 20px 12px`,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <button onClick={onClose} style={{
          width:34, height:34, borderRadius:10, border:'none', cursor:'pointer',
          background:'transparent', display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--text-sub)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
            {isBackfill ? 'Оценки за день' : 'Трекер потребностей'}
          </div>
          <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>
            {isBackfill ? date : 'свайп · тап по шкале · +/−'}
          </div>
        </div>
        {/* Карандаш + история */}
        {!isBackfill ? (
          <div style={{ display:'flex', gap:8 }}>
            {onOpenNote && (
              <button onClick={onOpenNote} style={{
                width:34, height:34, borderRadius:10, border:'none', cursor:'pointer',
                background:'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--text-sub)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
            )}
            {onOpenHistory && (
              <button onClick={() => { onClose(); onOpenHistory(); }} style={{
                width:34, height:34, borderRadius:10, border:'none', cursor:'pointer',
                background:'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--text-sub)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div style={{ width:34 }} />
        )}
      </div>

      {/* Onboarding */}
      {showOnb && (
        <div style={{ padding:'0 20px 8px', flexShrink:0 }}>
          <div style={{ background:'transparent', border:'1px solid var(--line)',
            borderRadius:16, padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:5, marginBottom:10 }}>
              {ONBOARDING_STEPS.map((_,i)=>(
                <div key={i} style={{ width:i===onbStep?16:6, height:6, borderRadius:3,
                  background:i===onbStep?'var(--accent)':'transparent', transition:'all 0.2s' }}/>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{ONBOARDING_STEPS[onbStep].emoji}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
                  {ONBOARDING_STEPS[onbStep].title}
                </div>
                <div style={{ fontSize:12, color:'var(--text-sub)', lineHeight:1.55 }}>
                  {ONBOARDING_STEPS[onbStep].text}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={dismissOnb} style={{ padding:'7px 12px', border:'none',
                fontFamily:'inherit', borderRadius:10, background:'transparent',
                color:'var(--text-faint)', fontSize:11, cursor:'pointer' }}>
                Пропустить
              </button>
              <button onClick={() => onbStep < 2 ? setOnbStep(s=>s+1) : dismissOnb()} style={{
                flex:1, padding:'8px', border:'none', fontFamily:'inherit', borderRadius:10,
                background:'transparent', color:'var(--accent)',
                fontSize:12, fontWeight:600, cursor:'pointer',
              }}>
                {onbStep < 2 ? 'Далее →' : 'Понятно, начнём'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Need name pill — top */}
      <div style={{ flexShrink:0, paddingTop:showOnb?4:8, textAlign:'center' }}>
        <div onClick={() => setDetailNeed(need)} style={{
          display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer',
          padding:'6px 16px', borderRadius:20,
          background:'transparent', border:'1px solid var(--line)',
        }}>
          <span style={{ fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px' }}>
            {need.chartLabel}
          </span>
          <span style={{ fontSize:11, color:'var(--text-faint)' }}>ⓘ</span>
          {delta !== null && delta !== 0 && (
            <span style={{
              fontSize:11, fontWeight:600,
              color:delta>0?'var(--accent-green)':'var(--accent-red)',
              background:delta>0?'color-mix(in srgb, var(--accent-green) 12%, transparent)':'color-mix(in srgb, var(--accent-red) 12%, transparent)',
              borderRadius:10, padding:'1px 7px',
            }}>
              {delta>0?'+':''}{delta}
            </span>
          )}
        </div>
      </div>

      {/* Dial + desc — one centered column */}
      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'space-evenly', overflow:'hidden' }}>

        {NEED_DATA[need.id]?.desc && (
          <div style={{
            fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55,
            textAlign: 'center', padding: '0 32px',
          }}>
            {NEED_DATA[need.id].desc}
          </div>
        )}

        <NeedDial
          need={need} color={COLORS[need.id]??'#888'} value={value}
          onChange={v => { dismissOnb(); handleChange(need.id, v); }}
        />

        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => handleChange(need.id, Math.max(0, value-1))} style={{
            width:46, height:46, borderRadius:23, border:'none', fontFamily:'inherit',
            background:'transparent', color:'var(--text-sub)',
            fontSize:22, fontWeight:300, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>−</button>
          <div style={{ width:64, textAlign:'center', fontSize:9, color:'var(--text-faint)',
            fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase' }}>
            тап по шкале
          </div>
          <button onClick={() => handleChange(need.id, Math.min(10, value+1))} style={{
            width:46, height:46, borderRadius:23, border:'none', fontFamily:'inherit',
            background:'transparent', color:'var(--text-sub)',
            fontSize:22, fontWeight:300, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>+</button>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding:'0 20px', paddingBottom:'max(20px, env(safe-area-inset-bottom, 20px))', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
        {/* Summary when all done */}
        {allRated && (
          <div style={{ background:'transparent', border:'1px solid var(--line)',
            borderRadius:16, padding:'14px 18px',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text-faint)', marginBottom:4 }}>Индекс дня</div>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--text)' }}>
                {avg.toFixed(1)}<span style={{ fontSize:13, color:'var(--text-sub)' }}>/10</span>
              </div>
            </div>
            <SummaryDonut avg={avg}/>
          </div>
        )}

        {allRated && (
          <button onClick={isBackfill ? (onDone ?? onClose) : onClose} style={{
            width:'100%', padding:'14px', borderRadius:16, border:'1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)',
            background:'color-mix(in srgb, var(--accent-green) 12%, transparent)', color:'var(--accent-green)',
            fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>
            Готово — сохранить всё ✓
          </button>
        )}

        {/* Nav */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => idx>0 && setIdx(idx-1)} style={{
            flex:1, padding:'13px', borderRadius:14, border:'none', fontFamily:'inherit',
            background:idx===0?'transparent':'transparent',
            color:idx===0?'var(--text-faint)':'var(--text-sub)',
            fontSize:14, cursor:idx===0?'default':'pointer',
          }}>← Назад</button>
          {idx < needs.length - 1 && (
            <button onClick={() => setIdx(idx+1)} style={{
              flex:2, padding:'13px', borderRadius:14, border:'none', fontFamily:'inherit',
              background:'var(--accent)',
              color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
            }}>
              Далее →
            </button>
          )}
        </div>

        {/* Autosave status */}
        {lastSavedAt && (
          <div style={{ textAlign:'center', fontSize:11, color:'var(--text-faint)' }}>
            Сохранено {lastSavedAt.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {detailNeed && (
        <NeedTodaySheet
          need={detailNeed}
          value={effectiveRatings[detailNeed.id] ?? 0}
          yesterdayValue={yesterdayRatings[detailNeed.id] ?? YESTERDAY[detailNeed.id]}
          onChange={v => handleChange(detailNeed.id, v)}
          onClose={() => setDetailNeed(null)}
        />
      )}
    </div>
  );
}
