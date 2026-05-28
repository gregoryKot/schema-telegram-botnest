// TrackerOverlay.tsx — Full tracker as standalone overlay

import { useState, useRef, useCallback, useEffect } from 'react';
import { COLORS, YESTERDAY } from '../types';
import type { Need } from '../types';
import { NEED_DATA } from '../needData';
import { NeedDial } from './NeedDial';
import { NeedTodaySheet } from './NeedTodaySheet';
import { GlyphArrowLeft } from './exercises/ExScreen';

import { api } from '../api';
import type { StreakData } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';

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

export function TrackerOverlay({
  needs, ratings, saved: _saved, isOffline,
  onChange, onSaved, onClose, initialNeedId,
  onOpenNote, onOpenGoal: _onOpenGoal, onOpenHistory, yesterdayRatings = {},
  date, onDone,
}: Props) {
  const goBack = useHistorySheet(onClose);
  const timers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const unlockTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
  const ratedCount = needs.filter(n => (effectiveRatings[n.id] ?? 0) > 0).length;

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

  // Swipe between needs
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTS(e: React.TouchEvent) { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  function onTE(e: React.TouchEvent) {
    if (touchRef.current === null || detailNeed) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
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

      {/* ── Topbar ── */}
      <div className="ex-topbar" style={{ justifyContent:'space-between', flexShrink:0 }}>
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> {isBackfill ? 'Закрыть' : 'Назад'}
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
            {isBackfill ? 'Оценки за день' : 'Трекер потребностей'}
          </div>
          {isBackfill && (
            <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>{date}</div>
          )}
        </div>
        {!isBackfill ? (
          <div style={{ display:'flex', gap:4 }}>
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
              <button onClick={() => { onOpenHistory(); goBack(); }} style={{
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

      {/* ── Onboarding ── */}
      {showOnb && (
        <div style={{ padding:'0 20px 8px', flexShrink:0 }}>
          <div style={{
            background:'rgba(var(--fg-rgb),0.03)',
            border:'1px solid rgba(var(--fg-rgb),0.08)',
            borderRadius:20, padding:'16px 18px',
          }}>
            {/* Step dots */}
            <div style={{ display:'flex', gap:5, marginBottom:12 }}>
              {ONBOARDING_STEPS.map((_,i) => (
                <div key={i} style={{
                  width: i===onbStep ? 18 : 6, height:6, borderRadius:3,
                  background: i===onbStep ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.18)',
                  transition:'all 0.2s',
                }}/>
              ))}
            </div>
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:14 }}>
              <span style={{ fontSize:24, flexShrink:0, lineHeight:1 }}>{ONBOARDING_STEPS[onbStep].emoji}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:5 }}>
                  {ONBOARDING_STEPS[onbStep].title}
                </div>
                <div style={{ fontSize:13, color:'var(--text-sub)', lineHeight:1.6 }}>
                  {ONBOARDING_STEPS[onbStep].text}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={dismissOnb} style={{
                padding:'8px 14px', border:'none', fontFamily:'inherit', borderRadius:10,
                background:'transparent', color:'var(--text-faint)', fontSize:12, cursor:'pointer',
              }}>
                Пропустить
              </button>
              <button onClick={() => onbStep < 2 ? setOnbStep(s=>s+1) : dismissOnb()} style={{
                padding:'8px 16px', border:'none', fontFamily:'inherit', borderRadius:10,
                background:'var(--text)', color:'var(--bg)',
                fontSize:12, fontWeight:600, cursor:'pointer',
              }}>
                {onbStep < 2 ? 'Далее →' : 'Начнём'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Need heading ── */}
      <div style={{ flexShrink:0, padding: showOnb ? '8px 24px 0' : '12px 24px 0' }}>
        {/* Eyebrow */}
        <div className="eyebrow" style={{ marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color: COLORS[need.id] ?? 'var(--accent)' }}>●</span>
          <span>
            {isBackfill ? 'Заполни оценку' : `Потребность ${idx + 1} из ${needs.length}`}
          </span>
          {ratedCount > 0 && !allRated && (
            <span style={{ color:'var(--text-faint)', fontWeight:400, marginLeft:'auto' }}>
              {ratedCount} оценено
            </span>
          )}
          {allRated && (
            <span style={{ color:'var(--accent-green)', fontWeight:600, marginLeft:'auto' }}>
              ✓ все готово
            </span>
          )}
        </div>

        {/* Name + delta + detail link */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <button onClick={() => setDetailNeed(need)} style={{
            background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left',
            display:'flex', alignItems:'center', gap:12,
          }}>
            <span style={{ fontSize:32, lineHeight:1 }}>{need.emoji}</span>
            <div>
              <div style={{
                fontFamily:'var(--serif)', fontSize:26, fontWeight:400,
                color:'var(--text)', lineHeight:1.1,
              }}>
                {need.chartLabel}
              </div>
              <div style={{ fontSize:12, color:'var(--accent)', marginTop:3, fontWeight:500 }}>
                подробнее →
              </div>
            </div>
          </button>

          {delta !== null && delta !== 0 && (
            <div style={{
              flexShrink:0, padding:'4px 10px', borderRadius:20,
              fontSize:12, fontWeight:600,
              color: delta>0 ? 'var(--accent-green)' : 'var(--accent-red)',
              background: delta>0
                ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                : 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
            }}>
              {delta>0?'+':''}{delta} вчера
            </div>
          )}
        </div>

        {/* Description */}
        {NEED_DATA[need.id]?.desc && (
          <div style={{
            fontSize:13, color:'var(--text-sub)', lineHeight:1.6,
            marginTop:10, paddingBottom:4,
          }}>
            {NEED_DATA[need.id].desc}
          </div>
        )}
      </div>

      {/* ── Dial area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', overflow:'hidden', minHeight:0 }}>
        <NeedDial
          need={need} color={COLORS[need.id]??'#888'} value={value}
          onChange={v => { dismissOnb(); handleChange(need.id, v); }}
        />

        {/* +/- controls */}
        <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:4 }}>
          <button onClick={() => handleChange(need.id, Math.max(0, value-1))} style={{
            width:50, height:50, borderRadius:25,
            border:'1.5px solid rgba(var(--fg-rgb),0.12)',
            background:'rgba(var(--fg-rgb),0.03)',
            color:'var(--text)',
            fontSize:24, fontWeight:300, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 0.15s',
          }}>−</button>
          <div style={{ width:72, textAlign:'center', fontSize:9, color:'var(--text-faint)',
            fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            тап по дуге
          </div>
          <button onClick={() => handleChange(need.id, Math.min(10, value+1))} style={{
            width:50, height:50, borderRadius:25,
            border:'1.5px solid rgba(var(--fg-rgb),0.12)',
            background:'rgba(var(--fg-rgb),0.03)',
            color:'var(--text)',
            fontSize:24, fontWeight:300, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 0.15s',
          }}>+</button>
        </div>
      </div>

      {/* ── Bottom ── */}
      <div style={{
        padding:'0 20px',
        paddingBottom:'max(20px, env(safe-area-inset-bottom, 20px))',
        display:'flex', flexDirection:'column', gap:10, flexShrink:0,
      }}>
        {/* Summary when all rated */}
        {allRated && (
          <div style={{
            background:'rgba(var(--fg-rgb),0.04)',
            border:'1px solid rgba(var(--fg-rgb),0.08)',
            borderRadius:16, padding:'14px 18px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text-faint)', marginBottom:3 }}>Индекс дня</div>
              <div style={{
                fontFamily:'var(--serif)', fontSize:32, fontWeight:400, color:'var(--text)', lineHeight:1,
              }}>
                {avg.toFixed(1)}
                <span style={{ fontFamily:'inherit', fontSize:14, color:'var(--text-sub)' }}> /10</span>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'var(--text-faint)', marginBottom:3 }}>Оценено</div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>
                {ratedCount}<span style={{ fontSize:13, color:'var(--text-sub)', fontWeight:400 }}>/{needs.length}</span>
              </div>
            </div>
          </div>
        )}

        {allRated && (
          <button onClick={isBackfill ? (onDone ?? goBack) : goBack} className="btn-primary">
            ✓ Готово — сохранить
          </button>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={() => idx > 0 && setIdx(idx-1)}
            disabled={idx === 0}
            style={{
              flex:1, padding:'13px', borderRadius:14, border:'none', fontFamily:'inherit',
              background:'transparent',
              color: idx===0 ? 'var(--text-faint)' : 'var(--text-sub)',
              fontSize:14, cursor: idx===0 ? 'default' : 'pointer',
            }}
          >← Назад</button>

          {idx < needs.length - 1 ? (
            <button onClick={() => setIdx(idx+1)} className="btn-primary" style={{ flex:2 }}>
              Далее →
            </button>
          ) : !allRated ? (
            <button onClick={() => {
              const first = needs.findIndex(n => !(effectiveRatings[n.id] ?? 0));
              if (first >= 0) setIdx(first);
            }} style={{
              flex:2, padding:'13px', borderRadius:14, border:'1px solid rgba(var(--fg-rgb),0.12)',
              background:'transparent', fontFamily:'inherit',
              color:'var(--text-sub)', fontSize:14, cursor:'pointer',
            }}>
              К незаполненным ↩
            </button>
          ) : null}
        </div>

        {/* Autosave status */}
        {lastSavedAt && (
          <div style={{ textAlign:'center', fontSize:11, color:'var(--text-faint)' }}>
            Сохранено {lastSavedAt.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
          </div>
        )}
      </div>

      {/* ── Detail sheet ── */}
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
