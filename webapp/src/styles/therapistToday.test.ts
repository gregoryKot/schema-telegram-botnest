// @vitest-environment node
// «Сегодня» терапевта (#906): счётчики на бумаге (ds-card--row на --surface), поэтому
// знаменатель «/ N» красится токеном для бумаги, а не --on-ink-* (токены тёмной подложки).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'therapist-today.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('therapist-today.css: контраст на бумаге', () => {
  it('нет токенов --on-ink-* (их место только на ds-card--ink/--accent)', () => {
    expect(css).not.toMatch(/--on-ink-/);
  });
  it('.tt-denom красится var(--text-faint)', () => {
    const m = css.match(/\.tt-denom\s*\{([^}]*)\}/);
    expect(m?.[1]).toContain('color: var(--text-faint)');
  });
});
