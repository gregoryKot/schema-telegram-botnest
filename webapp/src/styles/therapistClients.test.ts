// @vitest-environment node
// «Все клиенты» терапевта. QA 2026-11: длинное имя в карточке клиента рвалось
// посреди слова в 3–4 строки (overflow-wrap: anywhere). CSS в jsdom не
// исполняется, поэтому сверяем строки therapist-clients.css (приём safeTop.test.ts).
// b29: «Константин Констант…» в строке — имя переносится на вторую строку по словам.
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
  it('список — строки .ds-rows на бумаге без белого листа; свойства .ds-list-row — на два класса', () => {
    expect(css).not.toMatch(/\.tc-bar\b|\.tc-card\b|\.tc-grid\b/);
    const row = rule('.ds-list-row.tc-row');
    expect(row).toContain('grid-template-columns');
    expect(row).not.toContain('box-shadow');
    expect(row).not.toContain('background');
    expect(rule('.tc-row')).toBe(''); // без второго класса правило спорило бы с .ds-list-row порядком чанков
    const markup = readFileSync(join(__dirname, '../components/therapist/ClientCard.tsx'), 'utf8');
    expect(markup).toContain('className="ds-list-row ds-list-row--hover tc-row"');
    expect(markup).not.toMatch(/pp-leaf|ds-chev/);
    const list = readFileSync(join(__dirname, '../components/therapist/ClientListView.tsx'), 'utf8');
    expect(list).not.toContain('pp-leaf');
  });
  it('лупа палитры видна только там, где нет строки .topbar (телефон)', () => {
    // Общая кнопка FindButton (.find-btn, index.css) — у кабинета с классом-меткой .tc-find.
    const shell = readFileSync(join(__dirname, '../index.css'), 'utf8');
    expect(shell).toMatch(/\.ds-btn\.find-btn \{ display: none;/);
    expect(shell).toMatch(/\.topbar \{ display: none; \}\s*\.ds-btn\.find-btn \{ display: inline-flex; \}/);
    expect(readFileSync(join(__dirname, '../components/therapist/ClientListHero.tsx'), 'utf8')).toContain('className="tc-find"');
  });
  it('колонка имени во flex-строке сжимается: .tc-who — min-width: 0', () => {
    expect(rule('.tc-who')).toContain('min-width: 0');
  });
});
