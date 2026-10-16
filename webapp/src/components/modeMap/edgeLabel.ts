import type { CSSProperties } from 'react';

// Подпись на линии карты. Обычная подпись («активирует», «защищает») — серая
// плашка. ✗ и ✓ из схемы случая — круглый значок цвета самой линии: красный
// крестик «схема блокирует потребность» и зелёная галочка «о потребности
// заботятся» читаются с первого взгляда, как на ручной концептуализации.
const MARKS = new Set(['✗', '✓']);

const PLAIN: CSSProperties = {
  position: 'absolute', background: 'var(--bg-elev)', padding: '2px 7px', borderRadius: 'var(--r-6)',
  border: '1px solid var(--line)', fontSize: 11, color: 'var(--text-sub)',
  pointerEvents: 'all', whiteSpace: 'nowrap',
};

export function edgeLabelStyle(label: unknown, stroke: unknown, extra?: CSSProperties): CSSProperties {
  const plain = { ...PLAIN, ...extra };
  if (typeof label !== 'string' || !MARKS.has(label.trim()) || typeof stroke !== 'string') return plain;
  return {
    ...plain, width: 22, height: 22, padding: 0, borderRadius: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, color: stroke,
    border: `1.5px solid color-mix(in srgb, ${stroke} 55%, transparent)`,
  };
}
