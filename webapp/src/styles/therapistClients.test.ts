// @vitest-environment node
// «Все клиенты» терапевта. QA 2026-11: длинное имя в карточке клиента рвалось
// посреди слова в 3–4 строки (overflow-wrap: anywhere). CSS в jsdom не
// исполняется, поэтому сверяем строки therapist-clients.css (приём safeTop.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'therapist-clients.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) =>
  css.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.-]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('therapist-clients.css: имя в карточке клиента', () => {
  it('.tc-name — одна строка с многоточием, без overflow-wrap: anywhere', () => {
    const d = rule('.tc-name');
    expect(d).toContain('white-space: nowrap');
    expect(d).toContain('overflow: hidden');
    expect(d).toContain('text-overflow: ellipsis');
    expect(d).not.toContain('anywhere');
  });
  it('колонка имени во flex-строке сжимается: .tc-who — min-width: 0', () => {
    expect(rule('.tc-who')).toContain('min-width: 0');
  });
});
