import { useCallback, useEffect, useRef } from 'react';

// В9 дизайн-аудита 2026-08: pointer-only слайдер был недоступен с клавиатуры —
// единственный способ поставить значение в «Колесе детства». `NeedRatingBar`
// (10 нативных кнопок) решает ту же механику 0–10, но непрерывный drag-трек
// (заливка + бегунок) — часть визуальной идентичности упражнения, замена на
// кнопки была бы переверсткой (см. prC-notes.md). Поэтому клавиатура — в этом
// же компоненте: role="slider" + aria-value* + стрелки, вид тот же.
// `value` нет — не оценено: ни заливки, ни бегунка, читалка слышит «не оценено»,
// стрелки стартуют с середины; сохранить колесо так нельзя (FillPhase).
const MIN = 0;
const MAX = 10;

export function Slider({
  value,
  color,
  onChange,
  label,
}: {
  value: number | undefined;
  color: string;
  onChange: (v: number) => void;
  /** Доступное имя слайдера — что именно оцениваем (название потребности). */
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, []);
  const pct = (value ?? 0) * 10;

  const calcValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      onChange(
        Math.round(
          Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10,
        ),
      );
    },
    [onChange],
  );

  const onPtrDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      calcValue(e.clientX);
    },
    [calcValue],
  );

  const onPtrMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      calcValue(e.clientX);
    },
    [calcValue],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = (d: number) =>
        onChange(Math.max(MIN, Math.min(MAX, (value ?? 5) + d)));
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          step(1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          step(-1);
          break;
        case 'PageUp':
          e.preventDefault();
          step(2);
          break;
        case 'PageDown':
          e.preventDefault();
          step(-2);
          break;
        case 'Home':
          e.preventDefault();
          onChange(MIN);
          break;
        case 'End':
          e.preventDefault();
          onChange(MAX);
          break;
        default:
          break;
      }
    },
    [value, onChange],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={value}
      aria-valuetext={value === undefined ? 'не оценено' : `${value} из ${MAX}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPtrDown}
      onPointerMove={onPtrMove}
      style={{
        position: 'relative',
        padding: '12px 0',
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          height: 6,
          borderRadius: 'var(--r-6)',
          background: 'rgba(var(--fg-rgb),0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 'var(--r-6)',
            background: `linear-gradient(to right, ${color}55, ${color})`,
          }}
        />
      </div>
      <div
        style={{
          display: value === undefined ? 'none' : undefined,
          position: 'absolute',
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color,
          border: '2px solid var(--bg)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
