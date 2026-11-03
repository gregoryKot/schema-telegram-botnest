// @vitest-environment node
// «Сегодня» терапевта (#906): счётчики на бумаге (ds-card--row на --surface), поэтому
// знаменатель «/ N» красится токеном для бумаги, а не --on-ink-* (токены тёмной подложки).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'therapist-today.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Телефонный блок — последний в файле: всё от его заголовка до конца. */
const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
const desk = css.slice(0, css.indexOf('@media (max-width: 767px)'));
/** Тело первого правила с ровно этим селектором. */
const rule = (src: string, sel: string) =>
  src.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.-]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('therapist-today.css: контраст на бумаге', () => {
  it('нет токенов --on-ink-* (их место только на ds-card--ink/--accent)', () => {
    expect(css).not.toMatch(/--on-ink-/);
  });
  it('.tt-denom красится var(--text-faint)', () => {
    const m = css.match(/\.tt-denom\s*\{([^}]*)\}/);
    expect(m?.[1]).toContain('color: var(--text-faint)');
  });
});

// QA 2026-11: имя в «Активности клиентов» на телефоне шло в 12 строк по ~38px —
// трек спарклайна minmax(48px, 120px) добирал 120 раньше доли 1fr имени, а
// overflow-wrap: anywhere рвал имя посреди слова.
describe('therapist-today.css: имена в одну строку (QA 2026-11)', () => {
  it.each(['.tt-name', '.tt-act-name'])('%s — одна строка с многоточием, без overflow-wrap: anywhere', (sel) => {
    const d = rule(desk, sel);
    expect(d).toContain('white-space: nowrap');
    expect(d).toContain('overflow: hidden');
    expect(d).toContain('text-overflow: ellipsis');
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/);
  });
  it('колонка «имя + подпись» в сетке строки — min-width: 0', () => {
    expect(rule(desk, '.tt-who')).toContain('min-width: 0');
  });
  it('на телефоне спарклайн строки активности — на минимуме 48, имени отдаётся остаток', () => {
    expect(rule(phone, '.tt-act')).toContain('grid-template-columns: 36px minmax(0, 1fr) 48px 44px auto');
  });
});
