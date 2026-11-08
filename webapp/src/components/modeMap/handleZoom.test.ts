// @vitest-environment node
// Ручки связи карты режимов — в координатах холста, поэтому на фит-зуме ~0,5 зона 28px на экране
// становилась ≈14 (docs/open/frontend-ux.md). Размер ручки делится на текущий зум, но не больше
// низа узла (40) и не меньше десктопной зоны (18): иначе ручки съели бы сам узел.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleHitPx, HANDLE_HIT_VAR } from './handleZoom';

describe('handleHitPx — зона ручки в px холста', () => {
  it('зум 1 — прежние 28', () => {
    expect(handleHitPx(1)).toBe(28);
  });

  it('отдалили — зона растёт, на экране остаётся 28', () => {
    expect(handleHitPx(0.8)).toBe(35);
    expect(handleHitPx(0.8) * 0.8).toBe(28);
    expect(handleHitPx(0.75)).toBeCloseTo(37.3, 1);
  });

  it('сильно отдалили — не больше 40: ручки не накрывают узел высотой 40 целиком', () => {
    expect(handleHitPx(0.5)).toBe(40);
    expect(handleHitPx(0.2)).toBe(40);
  });

  it('приблизили — зона тает до 18, на экране не меньше 28', () => {
    expect(handleHitPx(1.4)).toBe(20);
    expect(handleHitPx(2)).toBe(18);
  });

  it('зума нет или он битый — прежние 28', () => {
    expect(handleHitPx(0)).toBe(28);
    expect(handleHitPx(Number.NaN)).toBe(28);
    expect(handleHitPx(-1)).toBe(28);
  });
});

describe('CSS ручки берёт размер из переменной', () => {
  it('на (hover: none) ширина и высота .mm-handle — var(--mm-handle-hit), по умолчанию 28px в :root', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8');
    const block = css.match(/@media \(hover: none\)\s*\{\s*\.mm-handle\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(HANDLE_HIT_VAR).toBe('--mm-handle-hit');
    expect(block).toMatch(/width: var\(--mm-handle-hit\) !important/);
    expect(block).toMatch(/height: var\(--mm-handle-hit\) !important/);
    expect(css).toMatch(/:root \{[^}]*--mm-handle-hit: 28px;/);
  });
});
