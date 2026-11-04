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
  '.tk-card-label', '.tk-next-edit', '.tk-next-sub', '.tk-action', '.tk-actions-grid', '.tk-hint', '.tk-block', '.tk-day',
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

  it('аватар — tint тона клиента держит примитив .ds-avatar.tone-tint (cabinet.css), локальной копии нет; на телефоне 44×44', () => {
    expect(decls(css, '.tk-avatar.tone-tint')).toBe('');
    expect(decls(phone, '.tk-avatar')).toContain('width: 44px');
    expect(decls(phone, '.tk-avatar')).toContain('height: 44px');
  });

  it('Встреча в шапке — та же форма, что в списке: у .tc-meeting нет background, у .tk-head .tc-meeting только flex-basis; в therapist-card.css нет .mm2-item и .tk-menu', () => {
    const list = readFileSync(join(__dirname, 'therapist-clients.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(decls(list, '.tc-meeting')).not.toContain('background');
    expect(decls(css, '.tk-head .tc-meeting').replace(/\s/g, '')).toBe('flex-basis:100%;');
    expect(css).not.toContain('.mm2-item');
    expect(css).not.toContain('.tk-menu');
  });

  it('шаг стопки карточек — 16: у .tk-side и .tk-col, без телефонного переопределения', () => {
    expect(decls(css, '.tk-side')).toContain('gap: 16px');
    expect(decls(css, '.tk-col')).toContain('gap: 16px');
    expect(decls(phone, '.tk-col')).toBe('');
  });

  it('цель терапии — Manrope 15 обычным текстом; цвета — только токенами и тонами', () => {
    const text = decls(css, '.tk-text');
    expect(text).toContain('15px');
    expect(text).toContain('var(--sans)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('текст на акцентной карточке красит примитив .ds-card--accent (cabinet.css) — локальных правил нет', () => {
    expect(css).not.toMatch(/\.tk-side \.ds-card--accent/);
  });
});

// QA 2026-11: длинное имя клиента рвалось посреди слова («Константинопо/льская»),
// длинное слово заметки сессии уезжало за правый край карточки на телефоне,
// две кнопки сайдбара на 1280 падали в два ряда разной ширины.
describe('therapist-card.css: имя, заметка, действия сайдбара (QA 2026-11)', () => {
  it('имя не рвётся посреди слова: без overflow-wrap: anywhere; ноутбук — строка с многоточием, телефон — две строки', () => {
    for (const d of [decls(css, '.tk-name'), decls(phone, '.tk-name')]) {
      expect(d).not.toContain('anywhere');
      expect(d).not.toContain('word-break');
    }
    expect(decls(css, '.tk-name')).toContain('white-space: nowrap');
    expect(decls(css, '.tk-name')).toContain('overflow: hidden');
    expect(decls(phone, '.tk-name')).toContain('-webkit-line-clamp: 2');
  });

  it('заметка сессии на «Обзоре» переносит длинное слово, как .tb-note-text', () => {
    expect(decls(css, '.tk-note-text')).toMatch(/overflow-wrap: (anywhere|break-word)/);
  });

  it('действия узкого сайдбара (две колонки «Обзора», от 1024) — столбцом, не рядом с переносом', () => {
    const wide = block(css, '@media (min-width: 1024px)');
    expect(decls(wide, '.tk-side .tk-quick')).toContain('flex-direction: column');
    // На одну колонку (<1024) правило не распространяется: там кнопки в ряд.
    expect(decls(block(css, '@media (max-width: 1023px)'), '.tk-side .tk-quick')).toBe('');
  });
});
