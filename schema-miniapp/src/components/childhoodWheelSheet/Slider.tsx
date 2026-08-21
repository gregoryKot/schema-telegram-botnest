import { useCallback, useEffect, useRef } from 'react';

// В9 дизайн-аудита 2026-08: чисто pointer-based слайдер был недоступен с
// клавиатуры полностью — единственный способ поставить значение в
// упражнении «Колесо детства». `NeedRatingBar` (10 нативных кнопок) решает
// ту же механику 0–10, но здесь непрерывный drag-трек с другим визуальным
// языком (заливка + бегунок) — часть визуальной идентичности этого
// упражнения, замена на дискретные кнопки была бы переверсткой, а не
// точечным фиксом (см. prC-notes.md). Поэтому клавиатура добавлена в этот
// же компонент: role="slider" + aria-value* + стрелки, без изменения
// внешнего вида ни на пиксель.
const MIN = 0;
const MAX = 10;

export function Slider({
  value,
  color,
  onChange,
  label,
}: {
  value: number;
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
  const pct = value * 10;

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
        onChange(Math.max(MIN, Math.min(MAX, value + d)));
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
      aria-valuetext={`${value} из ${MAX}`}
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
          borderRadius: 6,
          background: 'rgba(var(--fg-rgb),0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 6,
            background: `linear-gradient(to right, ${color}55, ${color})`,
          }}
        />
      </div>
      <div
        style={{
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
