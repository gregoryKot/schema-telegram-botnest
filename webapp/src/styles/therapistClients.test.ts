// @vitest-environment node
// «Все клиенты» терапевта. QA 2026-11: длинное имя в карточке клиента рвалось
// посреди слова в 3–4 строки (overflow-wrap: anywhere). CSS в jsdom не
// исполняется, поэтому сверяем строки therapist-clients.css (приём safeTop.test.ts).
// b29: «Константин Констант…» в карточке — имя переносится на вторую строку по словам.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'therapist-clients.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) =>
  css.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.-]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('therapist-clients.css: имя в карточке клиента', () => {
  it('.tc-name — до двух строк по словам, многоточие на третьей, без overflow-wrap: anywhere', () => {
    const d = rule('.tc-name');
    expect(d).toContain('-webkit-line-clamp: 2');
    expect(d).toContain('overflow: hidden');
    expect(d).not.toContain('white-space: nowrap');
    expect(d).not.toContain('anywhere');
  });
  it('радужной полосы доменов нет; карточка — лист без обводки с тенью слоем', () => {
    expect(css).not.toMatch(/\.tc-bar\b/);
    const card = rule('.tc-card');
    expect(card).toContain('background: var(--surface)');
    expect(card).toMatch(/box-shadow: \d+px \d+px 0 oklch\(var\(--pa-layer-lc\) var\(--h\)\)/);
    expect(card).not.toContain('border:');
  });
  it('лупа палитры видна только там, где нет строки .topbar (телефон)', () => {
    expect(rule('.tc-find')).toContain('display: none');
    const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
    expect(phone).toMatch(/\.tc-find \{ display: inline-flex; \}/);
  });
  it('колонка имени во flex-строке сжимается: .tc-who — min-width: 0', () => {
    expect(rule('.tc-who')).toContain('min-width: 0');
  });
});
