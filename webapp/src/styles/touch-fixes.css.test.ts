import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// CSS не исполняется в jsdom, поэтому пинаем сами инварианты исходника:
// каждый из них — причина реального бага на iPhone (iOS Safari / PWA).
const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

describe('правки раскладки для телефона', () => {
  it('поля ввода на устройствах с касанием — не меньше 16px (иначе iOS приближает страницу)', () => {
    const css = read('styles/touch-fixes.css');
    const block = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(block).toContain('textarea');
    expect(block).toMatch(/font-size:\s*16px/);
  });

  it('анимации появления не держат fill-mode forwards: он создаёт контекст наложения и прячет листы под нижней панелью', () => {
    const css = read('index.css');
    for (const cls of ['animate-fade', 'animate-slide']) {
      const rule = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, cls).toContain('animation:');
      expect(rule, cls).not.toMatch(/\b(both|forwards)\b/);
    }
  });

  it('touch-fixes подключён в index.css', () => {
    expect(read('index.css')).toContain("@import './styles/touch-fixes.css'");
  });
});
