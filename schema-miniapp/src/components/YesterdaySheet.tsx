import { useState, useEffect, useRef, useCallback } from 'react';
import { Need, COLORS } from '../types';
import { api } from '../api';
import { BottomSheet } from './BottomSheet';
import { NeedRatingBar } from './NeedRatingBar';

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
    api
      .ratings(date)
      .then((r) => {
        setRatings(r);
        const s: Record<string, boolean> = {};
        for (const k of Object.keys(r)) s[k] = true;
        setSaved(s);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [date]);

  const handleChange = useCallback(
    (needId: string, value: number) => {
      setRatings((prev) => ({ ...prev, [needId]: value }));
      setSaved((prev) => ({ ...prev, [needId]: false }));
      clearTimeout(timers.current[needId]);
      timers.current[needId] = setTimeout(async () => {
        if (value === 0) return;
        try {
          await api.saveRating(needId, value, date);
          setSaved((prev) => ({ ...prev, [needId]: true }));
        } catch {
          setSaveError(true);
          setTimeout(() => setSaveError(false), 3000);
        }
      }, 500);
    },
    [date],
  );

  const allDone =
    needs.length > 0 && needs.every((n) => (ratings[n.id] ?? 0) > 0);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          Заполнить вчера
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 24 }}
        >
          {date}
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-sub)',
              padding: '40px 0',
            }}
          >
            Загрузка...
          </div>
        ) : loadError ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--accent-red)',
              padding: '40px 0',
              fontSize: 14,
            }}
          >
            Не удалось загрузить — попробуй позже
          </div>
        ) : (
          needs.map((n) => {
            const value = ratings[n.id] ?? 0;
            const color = COLORS[n.id] ?? '#888';
            const isSaved = saved[n.id];
            return (
              <SliderRow
                key={n.id}
                label={n.chartLabel}
                value={value}
                color={color}
                saved={isSaved}
                onChange={(v) => handleChange(n.id, v)}
              />
            );
          })
        )}

        {saveError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-red)',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Ошибка сохранения — нажми на шкалу ещё раз
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '13px 0',
            border: 'none',
            borderRadius: 12,
            background: allDone ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)',
            color: allDone ? '#fff' : 'rgba(var(--fg-rgb),0.5)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {allDone ? 'Готово' : 'Закрыть'}
        </button>
      </div>
    </BottomSheet>
  );
}

function SliderRow({
  label,
  value,
  color,
  saved,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  saved: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saved && value > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>✓</span>
          )}
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: value > 0 ? color : 'rgba(var(--fg-rgb),0.2)',
            }}
          >
            {value > 0 ? value : '—'}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-sub)',
              }}
            >
              {value > 0 ? '/10' : ''}
            </span>
          </span>
        </div>
      </div>
      <NeedRatingBar color={color} value={value} onChange={onChange} />
    </div>
  );
}
