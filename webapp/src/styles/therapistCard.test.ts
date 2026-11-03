// @vitest-environment node
// Тихая карточка клиента (#906, волна 1): закреплённой панели действий на
// телефоне нет, плиток с заливкой, кавычки-глифа и локальных копий примитивов
// нет, кегль имени — ds-h2, аватар — tint. CSS в jsdom не исполняется, поэтому
// сверяем строки therapist-card.css (приём safeTop.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'therapist-card.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Тело первого блока, начинающегося с `head` (по балансу скобок). */
function block(src: string, head: string): string {
  const at = src.indexOf(head);
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return '';
}

/** Объявления всех правил, в списке селекторов которых стоит ровно `sel`, через `;`. */
function decls(src: string, sel: string): string {
  return [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').map((s) => s.trim()).includes(sel))
    .map((m) => m[2].trim())
    .join(';');
}

const phone = block(css, '@media (max-width: 767px)');

// Локальные копии примитивов и плитки, ушедшие вместе с заменой на ds-*.
const GONE = [
  '.tk-actions-main', '.tk-head--quiet-actions', '.tk-back', '.tk-edit', '.tk-name-row',
  '.tk-tile', '.tk-tile-title', '.tk-tile-item', '.tk-tiles', '.tk-quote', '.tk-goal-text', '.tk-mode-col', '.tk-modes',
  '.tk-card-label', '.tk-next-edit', '.tk-next-sub', '.tk-action', '.tk-hint', '.tk-block',
];

describe('therapist-card.css: тихая карточка клиента (#906)', () => {
  it('закреплённой панели действий нет: ни position: fixed, ни .tk-actions-main', () => {
    expect(css).not.toContain('position: fixed');
    expect(css).not.toContain('.tk-actions-main');
    expect(css).not.toContain('padding-bottom: 96px');
  });

  it.each(GONE)('%s больше не объявлен (заменён примитивом ds-*)', (cls) => {
    expect(css).not.toMatch(new RegExp(`${cls.replace(/[.-]/g, '\\$&')}(?![\\w-])`));
  });

  it('кегль имени задаёт ds-h2: у .tk-name только перенос', () => {
    for (const d of [decls(css, '.tk-name'), decls(phone, '.tk-name')]) {
      expect(d).not.toContain('font');
      expect(d).not.toContain('font-size');
    }
    expect(decls(css, '.tk-name')).toContain('text-overflow: ellipsis');
    expect(decls(phone, '.tk-name')).toContain('-webkit-line-clamp: 2');
  });

  it('аватар — tint тона клиента с тёмными инициалами, на телефоне 44×44', () => {
    const tint = decls(css, '.tk-avatar.tone-tint');
    expect(tint).toContain('background: oklch(0.94 0.035 var(--h))');
    expect(tint).toContain('color: oklch(0.38 0.1 var(--h))');
    expect(decls(phone, '.tk-avatar')).toContain('width: 44px');
    expect(decls(phone, '.tk-avatar')).toContain('height: 44px');
  });

  it('строка «Встреча» в шапке — без подложки списка, своей строкой; пункты меню «⋯» — тап-цель 44', () => {
    const line = decls(css, '.tk-head .tc-meeting');
    expect(line).toContain('background: none');
    expect(line).toContain('flex-basis: 100%');
    expect(decls(css, '.tk-menu .mm2-item')).toContain('min-height: 44px');
  });

  it('цель терапии — Manrope 15 обычным текстом; цвета — только токенами и тонами', () => {
    const text = decls(css, '.tk-text');
    expect(text).toContain('15px');
    expect(text).toContain('var(--sans)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('на акцентной карточке сайдбара подпись, подпись-строка и ссылка светлые', () => {
    for (const sel of ['.tk-side .ds-card--accent .ds-label', '.tk-side .ds-card--accent .ds-sub', '.tk-side .ds-card--accent .ds-link']) {
      expect(decls(css, sel), sel).toContain('color: var(--on-ink)');
    }
  });
});
