// @vitest-environment node
// Тихая карточка клиента (#906, волна 1): закреплённой панели действий на
// телефоне нет, плиток с заливкой, кавычки-глифа и локальных копий примитивов
// нет, кегль имени — ds-h2, аватар — tint. CSS в jsdom не исполняется, поэтому
// сверяем строки therapist-card.css (приём safeTop.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from '../utils/phoneLayout';

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

const phone = block(css, `@media ${PHONE_MEDIA}`);

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

// Регрессия 2026-11-04: «сайт выглядел как компьютерная версия, а стал как
// мобильник». «Обзор» на ≥768 возвращает раскладку макета; строки в одной
// карточке и 15px — только телефон.
describe('therapist-card.css: «Обзор» — компьютер и телефон (регрессия 2026-11-04)', () => {
  const desk = block(css, `@media ${DESKTOP_MEDIA} {\n  .tk-goal`);

  it('на ≥768: цель — 24px с засечками (макет REDESIGN_2026-10: Literata 24px), схемы — плитки до 3 в ряд, режимы — колонки с верхней чертой', () => {
    expect(decls(desk, '.tk-goal .tk-text')).toMatch(/24px\/1\.4 var\(--serif\)/);
    expect(decls(desk, '.tk-groups')).toContain('display: grid');
    expect(decls(desk, '.tk-groups--tiles')).toContain('/ 3)');
    expect(decls(desk, '.tk-groups--cols')).toContain('/ 3)');
    expect(decls(desk, '.tk-groups--cols .tk-group')).toContain('border-top: 3px solid');
  });

  it('сплошных заливок нет: плитка — тонкая подложка и рамка, не tone-fill/tone-soft', () => {
    expect(css).not.toMatch(/tone-soft|tone-fill/);
    expect(decls(desk, '.tk-groups--tiles .tk-group')).toContain('border: 1px solid');
  });

  it('сетка групп и крупная цель объявлены только под ≥768; в базе и на телефоне — строки и 15px', () => {
    const outside = css.replace(desk, '');
    expect(outside).not.toMatch(/\.tk-groups--|grid-template-columns: repeat\(auto-fill/);
    expect(decls(outside, '.tk-groups')).toContain('flex-direction: column');
    expect(decls(outside, '.tk-text')).toContain('15px');
    expect(decls(phone, '.tk-goal .tk-text')).toBe('');
    expect(decls(phone, '.tk-groups')).toBe('');
  });
});

// Владелец 2026-11-06: при уходе с «Графических карт» шапка прыгала вбок —
// #962 давал ей там поле 16px вместо колонки кабинета. Шапка одна на все
// вкладки; полоса карт над холстом встаёт в колонку с тем же полем, что у
// шапки. Два места обязаны совпадать — сверка здесь (правило №4).
// Бриф b34 сузил только ВЫСОТУ шапки на «Графических картах» (.tk-head--compact). Первая версия
// модификатора перекладывала шапку сеткой в одну строку — имя уезжало вбок на 85px (1280) и
// резалось на 768 (ревью вёрстки r1). Решение «шапка не прыгает вбок» соблюдено: модификатор
// не трогает ни одного горизонтального свойства и не меняет раскладку строки имени.
describe('therapist-card.css: шапка не прыгает между вкладками (2026-11-06)', () => {
  const col = block(css, `@media ${DESKTOP_MEDIA} {\n  .tk-tabs-body`);
  const compact = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap((m) => m[1].split(',').map((sel) => [sel.trim(), m[2]] as const))
    .filter(([sel]) => sel.startsWith('.tk-head--compact'));

  it('модификатора ширины у шапки нет: единственный .tk-head--compact («Графические карты», b34) меняет высоту, боковое поле не трогает', () => {
    const mods = [...css.matchAll(/\.tk-head--([\w-]+)/g)].map((m) => m[1]);
    expect(new Set(mods)).toEqual(new Set(['compact']));
    const own = decls(css, '.tk-head--compact');
    expect(own).toContain('padding-top');
    expect(own).not.toMatch(/padding(-inline|-left|-right)?\s*:|margin|display|grid|flex-direction/);
  });

  it('компактность — только по вертикали: раскладка строки имени та же, горизонтальных свойств нет', () => {
    // Строка «аватар · имя · действия» и «← Все клиенты» над ней — как у обычной шапки: ни сетки, ни порядка, ни переноса.
    expect(decls(css, '.tk-head--compact > .tk-head-row')).toBe('');
    expect(decls(css, '.tk-head--compact .tk-head-row')).toBe('');
    const HORIZONTAL = /(^|[;\s])(padding(-inline|-left|-right)?|margin(-inline|-left|-right)?|left|right|inset|grid[\w-]*|flex-direction|order|flex-wrap|min-width|max-width|justify-[\w-]+|position)\s*:/;
    // Два осознанных исключения: аватар (ниже — сверка, что ширина места не изменилась) и отступ плашки от имени.
    const ALLOWED = new Set(['.tk-head--compact .tk-avatar', '.tk-head--compact .tk-badges > *', '.tk-head--compact .tk-badges']);
    for (const [sel, body] of compact) if (!ALLOWED.has(sel)) expect(`${sel} { ${body} }`).not.toMatch(HORIZONTAL);
    // Модификатор не ветвится по ширине окна: одно поведение на 768, 1024 и 1280.
    expect(css).not.toMatch(/@media[^{]*\{[^{}]*\.tk-head--compact/);
  });

  it('аватар меньше, но занимает ту же ширину: имя стоит на той же вертикали, что на остальных вкладках', () => {
    const px = (d: string, prop: string) => Number(d.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`))?.[1]);
    const base = px(decls(css, '.tk-avatar'), 'width');
    const small = decls(css, '.tk-head--compact .tk-avatar');
    expect(base).toBe(56);
    expect(px(small, 'width') + px(small, 'margin-right')).toBe(base);
  });

  // Компактная шапка прятала всю строку .tk-badges — вместе с плашкой «офлайн». Прячутся только
  // статус активности и «Встреча»; плашки-состояния (и любые будущие) остаются в строке с именем.
  it('компактная шапка: строка плашек видна и стоит в одну строку с именем; скрыты только статус и «Встреча»', () => {
    expect(decls(css, '.tk-head--compact .tk-badges')).not.toMatch(/display:\s*none/);
    expect(decls(css, '.tk-head--compact .tk-badges')).toContain('flex-wrap: nowrap');
    expect(decls(css, '.tk-head--compact .tk-ident')).toMatch(/display:\s*flex/);
    const hidden = [...css.matchAll(/([^{}]+)\{([^{}]*display:\s*none[^{}]*)\}/g)]
      .flatMap((m) => m[1].split(',').map((x) => x.trim()))
      .filter((sel) => sel.startsWith('.tk-head--compact'));
    expect(hidden.sort()).toEqual(['.tk-head--compact .tk-badges > .tc-meeting', '.tk-head--compact .tk-badges > .tk-meta']);
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
