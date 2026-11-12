// @vitest-environment node
// Карточка клиента (#906, волна 1; живая бумага — b30): закреплённой панели действий на
// телефоне нет, кавычки-глифа и локальных копий примитивов нет, кегль имени — ds-h2
// без своего размера, аватар — бумага тона клиента. CSS в jsdom не исполняется, поэтому
// сверяем строки therapist-card.css (приём safeTop.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from '../utils/phoneLayout';

const strip = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const css = strip('therapist-card.css');
const cabinet = strip('cabinet.css');
const paper = strip('paper.css');

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

const phone = block(css, `@media ${PHONE_MEDIA}`);

// Локальные копии примитивов и плитки, ушедшие вместе с заменой на ds-*.
const GONE = [
  '.tk-actions-main', '.tk-head--quiet-actions', '.tk-back', '.tk-edit', '.tk-name-row',
  '.tk-tile', '.tk-tile-title', '.tk-tile-item', '.tk-tiles', '.tk-quote', '.tk-goal-text', '.tk-mode-col', '.tk-modes',
  '.tk-card-label', '.tk-next-edit', '.tk-next-sub', '.tk-action', '.tk-actions-grid', '.tk-hint', '.tk-block', '.tk-day',
  // b30: цветные квадратики-буллеты, плитки доменов с подложкой и колонки режимов с чертой ушли в SignGroup.
  '.tk-group', '.tk-groups--tiles', '.tk-groups--cols', '.tk-missing', '.tk-missing-text',
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

  it('кегль имени задаёт ds-h2/ds-h3: у .tk-name только перенос', () => {
    for (const d of [decls(css, '.tk-name'), decls(phone, '.tk-name'), decls(phone, '.tk-name--long')]) {
      expect(d).not.toContain('font');
    }
  });

  it('аватар — бумага тона клиента (--h) с тенью сплошным слоем, без размытия; на телефоне 44×44', () => {
    expect(decls(css, '.tk-avatar.tone-tint')).toBe('');
    // Бумага и тень — общий .ds-avatar--paper (cabinet.css, ревью r1: тот же кружок в списке, на «Сегодня»).
    expect(decls(cabinet, '.ds-avatar--paper')).toContain('oklch(0.915 0.03 var(--h))');
    expect(decls(cabinet, '.ds-avatar--paper')).toMatch(/box-shadow: \d+px \d+px 0 /);
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

  // Ревью r1: на телефоне шаг 16 у обеих колонок разом — «Обзор» на 390 не длиннее «до».
  it('шаг стопки листов — 20 у .tk-side и .tk-col, на телефоне — 16 у обеих одним правилом', () => {
    expect(decls(css, '.tk-side')).toContain('gap: 20px');
    expect(decls(css, '.tk-col')).toContain('gap: 20px');
    expect(decls(phone, '.tk-col')).toBe('gap: 16px;');
    expect(decls(phone, '.tk-side')).toBe('gap: 16px;');
  });

  it('цвета — только токенами и бумагой; размытия и тёмной акцентной карточки нет', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(css).not.toMatch(/blur|backdrop-filter|ds-card--accent/);
  });
});

// QA 2026-11: длинное имя клиента рвалось посреди слова («Константинопо/льская»),
// длинное слово заметки сессии уезжало за правый край карточки на телефоне,
// две кнопки сайдбара на 1280 падали в два ряда разной ширины.
describe('therapist-card.css: имя, заметка, действия сайдбара (QA 2026-11)', () => {
  // b30: одной строкой с многоточием длинное имя не было видно целиком нигде — теперь перенос.
  it('имя не рвётся посреди слова и переносится: ноутбук — две строки, телефон — длинное до четырёх', () => {
    for (const d of [decls(css, '.tk-name'), decls(phone, '.tk-name--long')]) {
      expect(d).not.toContain('anywhere');
      expect(d).not.toContain('word-break');
    }
    expect(decls(css, '.tk-name')).not.toContain('nowrap');
    expect(decls(css, '.tk-name')).toContain('-webkit-line-clamp: 2');
    expect(decls(phone, '.tk-name--long')).toContain('-webkit-line-clamp: 4');
    // Кнопки шапки не сжимают имя: блок действий не сжимается, имя берёт остаток.
    expect(decls(css, '.tk-actions')).toContain('flex: none');
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

// b30: «Обзор» — живая бумага. Группы схем и режимов — SignGroup в две колонки по ширине самой колонки
// (контейнер), «Встречи» — лист неба, трекер — лист соломы; белые листы — тень сплошным слоем.
describe('therapist-card.css: «Обзор» на бумаге (b30)', () => {
  it('группы — колонки по контейнеру, а не по окну', () => {
    expect(decls(css, '.tk-groups-box')).toContain('container: tk-groups / inline-size');
    expect(css).toMatch(/@container tk-groups \(min-width: 520px\) \{ \.tk-groups \{ grid-template-columns: repeat\(2/);
  });

  it('белый лист — тень сплошным сдвинутым слоем тоном бумаги, не размытием', () => {
    // Один лист на кабинет — .pp-leaf (paper.css, ревью r1); .tk-leaf задаёт только поля.
    expect(decls(paper, '.pp-leaf')).toMatch(/box-shadow: 6px 7px 0 oklch\(var\(--pa-layer-lc\) var\(--h, 240\)\)/);
    expect(decls(css, '.tk-leaf')).not.toContain('box-shadow');
  });

  it('незаполненное во «Встречах» — тихо (--text-sub), без красного', () => {
    expect(decls(css, '.tk-meet-none')).toContain('color: var(--text-sub)');
    expect(decls(css, '.tk-meet-none')).not.toMatch(/err|red|accent/);
  });

  it('потребность — цвет данных из inkVars: полоска --need-ink, число --need-text; красного «≤4» нет', () => {
    expect(decls(css, '.tk-need-bar > span')).toContain('var(--need-ink)');
    expect(decls(css, '.tk-need b')).toContain('var(--need-text)');
    expect(css).not.toContain('is-low');
  });

  it('полоса вкладок: маска-градиент у края с невидимыми вкладками, счётчик без плашки', () => {
    expect(decls(css, '.tk-tabs.is-fade-end')).toContain('mask-image: linear-gradient');
    expect(decls(css, '.tk-tabs.is-fade-start')).toContain('mask-image: linear-gradient');
    expect(decls(css, '.ds-count.tk-count')).toContain('background: none');
  });
});

// Владелец 2026-11-06: при уходе с «Графических карт» шапка прыгала вбок —
// #962 давал ей там поле 16px вместо колонки кабинета. Шапка одна на все
// вкладки; полоса карт над холстом встаёт в колонку с тем же полем, что у
// шапки. Два места обязаны совпадать — сверка здесь (правило №4).
describe('therapist-card.css: шапка не прыгает между вкладками (2026-11-06)', () => {
  const col = block(css, `@media ${DESKTOP_MEDIA} {\n  .tk-tabs-body`);

  it('модификатора ширины у шапки нет', () => {
    expect(css).not.toContain('.tk-head--');
  });

  it('полоса карт и строка ошибки создания — поле шапки, только под ≥768', () => {
    const field = decls(css, '.tk-head').match(/padding:\s*28px\s+(calc\(.+?\))\s+0;/)?.[1];
    expect(field).toBe('calc(var(--tk-center) + var(--tk-gutter))');
    for (const sel of ['.tk-tabs-body .mm2-bar', '.tk-tabs-body .mm2-create-err']) {
      expect(decls(col, sel)).toBe(`padding-inline: ${field};`);
      expect(decls(phone, sel)).toBe('');
    }
  });
});
