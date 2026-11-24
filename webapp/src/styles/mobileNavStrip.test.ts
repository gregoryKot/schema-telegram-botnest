// @vitest-environment node
// Нижнее меню телефона — «Полоса» (владелец 2026-11-24, docs/design/PAPER_2026-11.md, принцип 5): бумага
// страницы и линия сверху, без тени, скругления, размытия и градиента; токенов «стекла» --glass-* в CSS нет.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from './cssRules.test-helpers';

const GLASS = /box-shadow|border-radius|backdrop-filter|background[^:;]*:[^;]*gradient/;

/** Объявления «стекла» в правилах самой полосы и её пунктов (`.mobile-nav`, `.mobile-nav-item…`). */
function glassyNav(css: string): string[] {
  return parseRules(css)
    .filter((r) => r.selectors.some((s) => s === '.mobile-nav' || s.startsWith('.mobile-nav-item')))
    .filter((r) => GLASS.test(r.body))
    .map((r) => `${r.selectors.join(', ')} { ${r.body.trim()} }`);
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => join(e.parentPath, e.name));
}

describe('нижнее меню телефона — «Полоса»', () => {
  const indexCss = readFileSync(join(__dirname, '../index.css'), 'utf8');

  it('у .mobile-nav и её пунктов нет тени, скругления, размытия и градиента; фон — бумага страницы', () => {
    expect(glassyNav(indexCss)).toEqual([]);
    const own = parseRules(indexCss).filter((r) => !r.media && r.selectors.includes('.mobile-nav')).map((r) => r.body).join(';');
    expect(own).toMatch(/background:\s*var\(--bg\)/);
    expect(own).toMatch(/border-top:\s*1px solid var\(--panel-line\)/);
  });

  it('контрольный образец: капсула-«стекло» находится', () => {
    const capsule = '.mobile-nav { background: linear-gradient(180deg, #fff, #eee); border-radius: 28px; }'
      + ' .mobile-nav-item.active { box-shadow: 0 2px 6px #0003; }';
    expect(glassyNav(capsule)).toHaveLength(2);
  });

  it('токенов --glass-* нет ни в одном CSS сайта и shared/', () => {
    const roots = [join(__dirname, '..'), join(__dirname, '../../../shared/src')];
    const hits = roots.flatMap(cssFiles).filter((f) => readFileSync(f, 'utf8').includes('--glass-'));
    expect(hits).toEqual([]);
  });
});
