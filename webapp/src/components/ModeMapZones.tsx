import { useViewport } from '@xyflow/react';
import { ZONES_BOTTOM } from './modeMap/zonesLayout';

// Clinical spatial grammar of a mode map (Schema Therapy with Couples, Roediger):
//   Healthy Adult — hovers above the system
//   Coping modes — front stage (observable behaviour)
//   Child + Critic(parent) modes — backstage (hidden motivation)
// Rendered in flow coordinates so the bands pan/zoom with the canvas.
// tint — палитровый оттенок полосы (заливка, пунктир), ink — читаемый текст того же тона (--accent-*).
const BANDS = [
  { y0: -460, y1: 60,  label: 'Здоровый Взрослый — над системой',      tint: 'var(--c-moss)',  ink: 'var(--accent-green)' },
  { y0: 60,   y1: 400, label: 'Копинги — на сцене (видимое поведение)', tint: 'var(--c-clay)',  ink: 'var(--accent-orange)' },
  { y0: 400,  y1: ZONES_BOTTOM, label: 'Детские и критикующие — за кулисами', tint: 'var(--c-slate)', ink: 'var(--accent-blue)' },
];
const LEFT = -3000, WIDTH = 6000;

export function ModeMapZones() {
  const { x, y, zoom } = useViewport();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
        {BANDS.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: LEFT, width: WIDTH, top: b.y0, height: b.y1 - b.y0,
            background: `color-mix(in srgb, ${b.tint} 7%, transparent)`,
            borderTop: `1px dashed color-mix(in srgb, ${b.tint} 38%, transparent)`,
          }}>
            <span style={{
              position: 'absolute', left: 3010, top: 8,
              fontSize: 12, fontWeight: 600, color: b.ink,
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
