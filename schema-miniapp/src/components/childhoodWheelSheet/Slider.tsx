import { useCallback, useEffect, useRef } from 'react';

export function Slider({
  value,
  color,
  onChange,
}: {
  value: number;
  color: string;
  onChange: (v: number) => void;
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

  return (
    <div
      ref={trackRef}
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
