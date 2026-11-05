// @vitest-environment node
// Инцидент 2026-11-05: в кабинете внутри Telegram текст без явного цвета был
// светлым на светлой бумаге. `.light-lock` переопределял токены, но `color`,
// унаследованный от body, оставался цветом тёмной темы (html[data-theme="dark"]).
// Тест держит правило, которое ставит цвет на самом поддереве.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CSS = readFileSync(join(__dirname, 'index.css'), 'utf8');

function ruleBody(selector: string): string | null {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

describe('.light-lock задаёт цвет текста сам', () => {
  const body = ruleBody('.light-lock');
  it('отдельное правило с селектором ровно .light-lock есть', () => {
    expect(body).not.toBeNull();
  });
  it('color: var(--text), чтобы цвет тёмного body не наследовался', () => {
    expect(body).toMatch(/color:\s*var\(--text\)/);
  });
  it('color-scheme: light', () => {
    expect(body).toMatch(/color-scheme:\s*light/);
  });
});
