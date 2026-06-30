import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import { Need, COLORS } from '../types';
import { api } from '../api';
import { BottomSheet } from './BottomSheet';

/** Prevent the iOS overflowY:auto container from stealing touch events on the slider track */
function usePreventScrollOnTrack(trackRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, [trackRef]);
}

interface Props {
  needs: Need[];
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

export function YesterdaySheet({ needs, date, onClose }: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api.ratings(date)
      .then(r => { setRatings(r); const s: Record<string, boolean> = {}; for (const k of Object.keys(r)) s[k] = true; setSaved(s); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    return () => { Object.values(timers.current).forEach(clearTimeout); };
  }, [date]);

  const handleChange = useCallback((needId: string, value: number) => {
    setRatings(prev => ({ ...prev, [needId]: value }));
    setSaved(prev => ({ ...prev, [needId]: false }));
    clearTimeout(timers.current[needId]);
    timers.current[needId] = setTimeout(async () => {
      if (value === 0) return;
      try {
        await api.saveRating(needId, value, date);
        setSaved(prev => ({ ...prev, [needId]: true }));
      } catch {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 3000);
      }
    }, 500);
  }, [date]);

  const allDone = needs.length > 0 && needs.every(n => (ratings[n.id] ?? 0) > 0);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Заполнить вчера</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 24 }}>{date}</div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '40px 0' }}>Загрузка...</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', color: 'var(--accent-red)', padding: '40px 0', fontSize: 14 }}>
            Не удалось загрузить — попробуй позже
          </div>
        ) : needs.map(n => {
          const value = ratings[n.id] ?? 0;
          const color = COLORS[n.id] ?? '#888';
          const isSaved = saved[n.id];
          return (
            <SliderRow
              key={n.id}
              needId={n.id}
              label={n.chartLabel}
              value={value}
              color={color}
              saved={isSaved}
              onChange={v => handleChange(n.id, v)}
            />
          );
        })}

        {saveError && (
          <div style={{ fontSize: 12, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 8 }}>
            Ошибка сохранения — потяни ползунок ещё раз
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: 8, width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
            background: allDone ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)',
            color: allDone ? '#fff' : 'rgba(var(--fg-rgb),0.5)',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {allDone ? 'Готово' : 'Закрыть'}
        </button>
      </div>
    </BottomSheet>
  );
}

function SliderRow({ needId, label, value, color, saved, onChange }: {
  needId: string; label: string; value: number; color: string; saved: boolean; onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  usePreventScrollOnTrack(trackRef);
  const pct = value * 10;

  const calc = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    onChange(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10));
  }, [onChange]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saved && value > 0 && <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>✓</span>}
          <span style={{ fontSize: 15, fontWeight: 600, color: value > 0 ? color : 'rgba(var(--fg-rgb),0.2)' }}>
            {value > 0 ? value : '—'}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-sub)' }}>{value > 0 ? '/10' : ''}</span>
          </span>
        </div>
      </div>
      <div
        ref={trackRef}
        onPointerDown={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); calc(e.clientX); }}
        onPointerMove={e => { if (e.buttons === 0) return; calc(e.clientX); }}
        style={{ position: 'relative', padding: '10px 0', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}
      >
        <div style={{ height: 6, borderRadius: 6, background: 'rgba(var(--fg-rgb),0.07)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(to right, ${color}55, ${color})` }} />
        </div>
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20, height: 20, borderRadius: '50%',
          background: value > 0 ? color : 'rgba(var(--fg-rgb),0.2)',
          border: '2px solid var(--bg)', pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}
