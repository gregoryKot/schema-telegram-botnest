import { useRef } from 'react';
import { hueStyle } from '../../../lib/tone';

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function CWTrack({
  value,
  onChange,
  hue,
}: {
  value: number;
  onChange: (v: number) => void;
  hue: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = value * 10;
  function compute(clientX: number) {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 10));
  }
  return (
    <div
      ref={ref}
      className="ex2-cw-track"
      style={hueStyle(hue)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        compute(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0) return;
        compute(e.clientX);
      }}
    >
      <div className="ex2-cw-line">
        <div className="ex2-cw-fill" style={{ width: pct + '%' }} />
        {[0, 25, 50, 75, 100].map((p) => (
          <div key={p} className="ex2-cw-pip" style={{ left: p + '%' }} />
        ))}
      </div>
      <div className="ex2-cw-thumb" style={{ left: pct + '%' }} />
    </div>
  );
}
