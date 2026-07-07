import { useViewport } from '@xyflow/react';

// Clinical spatial grammar of a mode map (Schema Therapy with Couples, Roediger):
//   Healthy Adult — hovers above the system
//   Coping modes — front stage (observable behaviour)
//   Child + Critic(parent) modes — backstage (hidden motivation)
// Rendered in flow coordinates so the bands pan/zoom with the canvas.
const BANDS = [
  { y0: -460, y1: 60,  label: 'Здоровый Взрослый — над системой',            color: 'var(--c-moss)' },
  { y0: 60,   y1: 400, label: 'Копинги — на сцене (видимое поведение)',       color: 'var(--c-clay)' },
  { y0: 400,  y1: 980, label: 'Детские и критикующие — за кулисами',          color: 'var(--c-slate)' },
];
const LEFT = -3000;
const WIDTH = 6000;

export function ModeMapZones() {
  const { x, y, zoom } = useViewport();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
        {BANDS.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: LEFT, width: WIDTH, top: b.y0, height: b.y1 - b.y0,
            background: `color-mix(in srgb, ${b.color} 7%, transparent)`,
            borderTop: `1px dashed color-mix(in srgb, ${b.color} 38%, transparent)`,
          }}>
            <span style={{
              position: 'absolute', left: 3010, top: 8,
              fontSize: 12, fontWeight: 600, color: b.color,
              letterSpacing: '0.01em', whiteSpace: 'nowrap',
            }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
