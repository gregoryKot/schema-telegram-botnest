import { useEffect } from 'react';
import { useRatingSlider } from '../../../../shared/src/childhoodWheel/useRatingSlider';

// В9 дизайн-аудита 2026-08: pointer-only слайдер был недоступен с клавиатуры —
// единственный способ поставить значение в «Колесе детства». `NeedRatingBar`
// (10 нативных кнопок) решает ту же механику 0–10, но непрерывный drag-трек
// (заливка + бегунок) — часть визуальной идентичности упражнения, замена на
// кнопки была бы переверсткой (см. prC-notes.md). Указатель, клавиатура и
// aria-value* — общий с сайтом useRatingSlider (shared), здесь только вид.
// `value` нет — не оценено: ни заливки, ни бегунка, читалка слышит «не оценено»,
// стрелки стартуют с середины; сохранить колесо так нельзя (FillPhase).
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
  const slider = useRatingSlider({ value, onChange, label });
  const trackRef = slider.ref;
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, [trackRef]);
  const pct = (value ?? 0) * 10;

  return (
    <div
      {...slider}
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
