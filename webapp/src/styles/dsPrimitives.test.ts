// @vitest-environment node
// Общие примитивы листов телефона (#906, волна 1, срез Foundation): шапка листа
// и «Назад», полноширинная кнопка, строка-переход с одним шевроном, пустое
// состояние, раскрывашка, тап-цели 44 на телефоне. CSS в jsdom не исполняется,
// поэтому сверяем строки cabinet.css (приём safeTop.test.ts): класс объявлен,
// ключевые объявления на месте, цвета — только токенами.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from '../utils/phoneLayout';

const css = readFileSync(join(__dirname, 'cabinet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

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
/** Тап-цели 44: один блок на телефон и на экран под пальцем (планшет). */
const TAP_MEDIA = '@media (pointer: coarse), (max-width: 767px)';
const tap = block(css, TAP_MEDIA);
/** Всё вне медиа-блоков (десктоп с мышью): там каждый примитив объявлен один раз. */
/** Компьютер (≥768): телефонные примитивы здесь не растягиваются, шапка страницы — не полоса. */
const desk = block(css, `@media ${DESKTOP_MEDIA}`);
const top = css.replace(phone, '').replace(tap, '').replace(desk, '');

/** Сколько правил вне медиа-блоков объявляют ровно селектор `sel`. */
function declaredTimes(sel: string): number {
  return [...top.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').map((s) => s.trim()).includes(sel)).length;
}

const NEW_CLASSES = [
  '.ds-sheet-head', '.ds-back', '.ds-btn--lg', '.ds-list-title', '.ds-list-sub', '.ds-chev',
  '.ds-empty', '.ds-fold', '.ds-fold-btn', '.ds-fold-chev', '.ds-fold-body',
];

describe('cabinet.css: примитивы листов (#906)', () => {
  it.each(NEW_CLASSES)('%s объявлен и красится только токенами', (cls) => {
    const d = decls(css, cls);
    expect(d).not.toBe('');
    expect(d).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  // Два исполнителя в одном дереве дописали .ds-btn--lg дважды: второе правило
  // молча перекрывало первое. Примитив объявляется один раз вне медиа-блоков.
  it.each(NEW_CLASSES)('%s объявлен ровно один раз вне медиа-блоков', (cls) => {
    expect(declaredTimes(cls)).toBe(1);
  });

  it('cabinet.css подключён в index.css', () => {
    expect(readFileSync(join(__dirname, '..', 'index.css'), 'utf8')).toContain("@import './styles/cabinet.css'");
  });

  it('.ds-sheet-head — бар 56 с бордером --line на фоне --bg; заголовок растягивается, правый слот у края', () => {
    const d = decls(css, '.ds-sheet-head');
    expect(d).toContain('display: flex');
    expect(d).toContain('min-height: 56px');
    expect(d).toContain('border-bottom: 1px solid var(--line)');
    expect(d).toContain('background: var(--bg)');
    for (const h of ['.ds-h1', '.ds-h2', '.ds-h3']) {
      expect(decls(css, `.ds-sheet-head > ${h}`), h).toContain('flex: 1');
      expect(decls(css, `.ds-sheet-head > ${h}`), h).toContain('margin: 0'); // .ds-h1 несёт 8px сверху
    }
    expect(decls(css, '.ds-sheet-head > :last-child')).toContain('margin-left: auto');
    expect(decls(phone, '.ds-sheet-head')).toContain('padding: 0 16px');
  });

  it('.ds-back — ссылка 13/600 цветом --accent, тап-цель 44, без рамки и фона', () => {
    const d = decls(css, '.ds-back');
    expect(d).toContain('min-height: 44px');
    expect(d).toContain('font: 600 13px var(--sans)');
    expect(d).toContain('color: var(--accent)');
    expect(d).toContain('border: none');
    expect(d).toContain('background: none');
    expect(decls(css, '.ds-back:hover')).toContain('color: var(--accent-hi)');
  });

  it('.ds-btn--lg — полноширинное главное действие листа: h48 r24, 15px', () => {
    const d = decls(css, '.ds-btn--lg');
    expect(d).toContain('min-height: 48px');
    expect(d).toContain('height: auto'); // базовый .ds-btn задаёт height: 44px
    expect(d).toContain('width: 100%');
    expect(decls(phone, '.ds-btn--lg')).toContain('width: 100%'); // во всю колонку — только на телефоне
    expect(decls(top, '.ds-btn--lg')).not.toContain('width');
    expect(d).toContain('border-radius: 24px');
    expect(d).toContain('font-size: 15px');
  });

  it('строка-переход: заголовок 14/600, подпись = ds-sub, шеврон — один глиф «›» из ::before', () => {
    expect(decls(css, '.ds-list-title')).toContain('font-size: 14px');
    expect(decls(css, '.ds-list-title')).toContain('font-weight: 600');
    expect(decls(css, '.ds-list-sub')).toBe(decls(css, '.ds-sub'));
    const chev = decls(css, '.ds-chev');
    expect(chev).toContain('font-size: 18px');
    expect(chev).toContain('color: var(--text-faint)');
    expect(chev).toContain('margin-left: auto');
    expect(decls(css, '.ds-chev:empty::before')).toContain("content: '›'");
  });

  it('.ds-empty — Manrope 14 цветом --text-muted, без курсива и отступов', () => {
    const d = decls(css, '.ds-empty');
    expect(d).toContain('14px');
    expect(d).toContain('var(--sans)');
    expect(d).toContain('color: var(--text-muted)');
    expect(d).toContain('font-style: normal');
    expect(d).toContain('margin: 0');
    expect(d).toContain('text-align: left');
  });

  it('.ds-fold — кнопка во всю ширину h48 без рамки, шеврон переворачивается по aria-expanded', () => {
    const fold = decls(css, '.ds-fold');
    expect(fold).toContain('border-radius: 16px');
    // Кольцо фокуса кнопки (outline-offset 3px в index.css) рисуется снаружи —
    // overflow: hidden на контейнере прятал бы его от клавиатуры (WCAG 2.4.7).
    expect(fold).not.toContain('overflow: hidden');
    const btn = decls(css, '.ds-fold-btn');
    expect(btn).toContain('width: 100%');
    expect(btn).toContain('min-height: 48px');
    expect(btn).toContain('justify-content: space-between');
    expect(btn).toContain('background: transparent');
    expect(btn).toContain('border: none');
    expect(decls(css, '.ds-fold-chev')).toContain('color: var(--text-faint)');
    expect(decls(css, '.ds-fold-btn[aria-expanded="true"] .ds-fold-chev')).toContain('transform: rotate(180deg)');
    expect(decls(css, '.ds-fold-body')).toContain('padding: 0 16px 16px');
  });

  it('.ds-label — капитель весом 600 (eyebrow 600–700 по REDESIGN_2026-10)', () => {
    const d = decls(css, '.ds-label');
    expect(d).toContain('text-transform: uppercase');
    expect(d).toContain('font-weight: 600');
  });

  it('на телефоне и под пальцем: иконочная кнопка 44×44, сегмент 44 высотой, малая кнопка 44 (вне блока 40); ds-h1 32 — только телефон', () => {
    expect(phone).not.toBe('');
    expect(tap).not.toBe('');
    expect(decls(tap, '.ds-btn--icon')).toContain('width: 44px');
    expect(decls(tap, '.ds-btn--icon')).toContain('height: 44px');
    expect(decls(tap, '.ds-seg-btn')).toContain('min-height: 44px');
    expect(decls(phone, '.ds-h1')).toContain('font-size: 32px');
    expect(decls(tap, '.ds-btn--sm')).toContain('height: 44px');
    expect(decls(top, '.ds-btn--sm')).toContain('height: 40px');
  });

  // QA 2026-11: вкладки карточки клиента были ~35px (padding 0 0 14px без
  // min-height) на любом экране, ссылки/сегменты/малые кнопки на планшете —
  // 20/30/40: блок телефона по ширине пальца на планшете не видел.
  it('.ds-tab — 44 на телефоне и под пальцем (pointer: coarse); десктоп с мышью не меняется', () => {
    expect(decls(tap, '.ds-tab')).toContain('min-height: 44px');
    expect(decls(tap, '.ds-tab')).toContain('min-width: 44px'); // короткая вкладка «Обзор» была 42 в ширину
    expect(decls(tap, '.ds-tab')).toContain('flex-shrink: 0'); // иначе min-width снимает min-width: auto и лента сжимает вкладки
    expect(decls(top, '.ds-tab')).not.toContain('min-height');
    for (const sel of ['.ds-tab', '.ds-link', '.ds-seg-btn', '.ds-btn--sm']) {
      expect(decls(tap, sel), sel).toMatch(/(min-)?height: 44px/);
    }
  });

  // QA 2026-11 (T-16): поле имени «Новый клиент» — 37, сайдбар на планшете
  // под пальцем — 34–38 (режим, поиск, строки клиентов).
  it('поле имени нового клиента и сайдбар кабинета — 44 в блоке тап-целей', () => {
    for (const sel of ['.tc-add-name', '.sb-mode-btn', '.sb-search', '.sb-client-item']) {
      expect(decls(tap, sel), sel).toContain('min-height: 44px');
    }
  });

  it('тап-цели живут в одном блоке: в блоке раскладки телефона их нет, второго блока pointer: coarse нет', () => {
    expect(css.split(TAP_MEDIA)).toHaveLength(2);
    expect(css.match(/@media \(pointer: coarse\)/g)).toHaveLength(1);
    for (const sel of ['.ds-tab', '.ds-btn--icon', '.ds-seg-btn', '.ds-btn--sm', '.ds-input--search', '.ds-input--sm', '.ds-chip--toggle', '.ds-link', '.ds-menu-item']) {
      expect(decls(phone, sel), sel).toBe('');
    }
  });
});

describe('cabinet.css: поправки координатора волны 1 (#906)', () => {
  it('одинокий «← Назад» в .ds-sheet-head остаётся слева: правило :first-child сильнее «последний ребёнок — вправо»', () => {
    expect(decls(top, '.ds-sheet-head > .ds-back:first-child')).toContain('margin-left: 0');
    expect(decls(top, '.ds-sheet-head > :last-child')).toContain('margin-left: auto');
  });
  it('.ds-avatar — tint по умолчанию: тёмные инициалы на светлой заливке, без #fff и без .tone-tint', () => {
    const av = decls(top, '.ds-avatar');
    expect(av).toContain('background: oklch(0.94 0.035 var(--h))');
    expect(av).toContain('color: oklch(0.38 0.1 var(--h))');
    expect(av).not.toMatch(/#fff/i);
    expect(css).not.toContain('.ds-avatar.tone-tint');
  });
  it('на акцентной карточке подпись, подпись-строка и ссылка — светлые токеном --on-accent', () => {
    for (const sel of ['.ds-card--accent .ds-label', '.ds-card--accent .ds-sub', '.ds-card--accent .ds-link']) {
      expect(decls(top, sel), sel).toContain('color: var(--on-accent)');
    }
  });
});

describe('cabinet.css: примитивы волны 2 (#906)', () => {
  const WAVE2 = [
    '.ds-seg--full', '.ds-input--search', '.ds-input--sm', '.ds-chip--toggle', '.ds-list-body',
    '.ds-list-row--nav', '.ds-list-row--inset', '.ds-card--nav', '.ds-card--crisis',
  ];
  it.each(WAVE2)('%s объявлен один раз вне медиа и красится токенами', (cls) => {
    expect(declaredTimes(cls)).toBe(1);
    expect(decls(css, cls)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
  it('сегмент: --full равные кнопки, --scroll только на телефоне с маской, счётчик без пилюли', () => {
    expect(decls(top, '.ds-seg--full')).toContain('display: flex');
    expect(decls(phone, '.ds-seg--full')).toContain('width: 100%'); // растяжение — только телефон
    expect(decls(desk, '.ds-seg--full')).toContain('display: inline-flex'); // на компьютере по содержимому
    expect(decls(desk, '.ds-seg--full > .ds-seg-btn')).toContain('min-width: max-content'); // и не уже подписи: basis 0 резал её многоточием
    expect(decls(top, '.ds-seg--full')).not.toContain('width');
    expect(decls(top, '.ds-seg--full > .ds-seg-btn')).toContain('flex: 1 1 0');
    expect(top).not.toContain('.ds-seg--scroll');
    expect(decls(phone, '.ds-seg--scroll')).not.toContain('mask-image');
    expect(decls(top, '.ds-seg-btn .ds-count')).not.toContain('opacity');
    expect(decls(phone, '.ds-seg--scroll > .ds-seg-btn')).toContain('flex: 0 0 auto');
    const count = decls(top, '.ds-seg-btn .ds-count');
    expect(count).toContain('background: none');
    expect(count).toContain('color: inherit');
    expect(decls(top, '.ds-page > .ds-seg')).toContain('align-self: flex-start');
  });
  // Голый ds-seg на телефоне стоит по ширине кнопок рядом с растянутыми соседями
  // («Клиенты/Задания» над фильтром во всю ширину, «День/Неделя» в истории).
  it('сегмент в разметке всегда с модификатором --full или --scroll', () => {
    const roots = [join(__dirname, '..'), join(__dirname, '..', '..', '..', 'shared', 'src')];
    const bare: string[] = [];
    let seen = 0;
    for (const root of roots) {
      for (const f of readdirSync(root, { recursive: true }) as string[]) {
        if (!f.endsWith('.tsx') || f.includes('.test.')) continue;
        for (const [, cls] of readFileSync(join(root, f), 'utf8').matchAll(/['"`]([^'"`\n]*)['"`]/g)) {
          if (!cls.split(/\s+/).includes('ds-seg')) continue;
          seen++;
          if (!/\bds-seg--(full|scroll)\b/.test(cls)) bare.push(`${f}: "${cls}"`);
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(10);
    expect(bare).toEqual([]);
  });
  it('поля: поиск и компактное, 16px под пальцем (и на iPad), resize: none остаётся', () => {
    expect(decls(top, '.ds-input--search')).toContain('height: 40px');
    expect(decls(top, '.ds-input--search')).toContain('border-radius: 20px');
    expect(decls(tap, '.ds-input--search')).toContain('height: 44px');
    expect(decls(tap, '.ds-input--search')).toContain('border-radius: 22px');
    expect(decls(top, '.ds-input--sm')).toContain('width: auto');
    expect(decls(top, '.ds-input--sm')).toContain('height: 40px');
    expect(decls(tap, '.ds-input--sm')).toContain('height: 44px');
    expect(decls(tap, '.ds-input')).toContain('font-size: 16px');
    expect(decls(tap, '.ds-textarea')).toContain('font-size: 16px');
    expect(decls(top, '.ds-textarea')).toContain('resize: none');
  });
  it('чип-переключатель: 36 → 44, выбранный — tint по --h без tone-fill', () => {
    expect(decls(top, '.ds-chip--toggle')).toContain('min-height: 36px');
    expect(decls(tap, '.ds-chip--toggle')).toContain('min-height: 44px');
    const on = decls(top, '.ds-chip--toggle.is-on');
    expect(on).toMatch(/oklch\([^)]*var\(--h(, \d+)?\)\)/);
    expect(on).not.toContain('tone-fill');
  });
  it('строка-переход и шеврон', () => {
    expect(decls(top, '.ds-list-row--nav')).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(decls(top, '.ds-chev')).toContain('transition');
    expect(decls(top, "[aria-expanded='true'] > .ds-chev")).toContain('rotate(90deg)');
  });
  it('карточки: --nav раньше цветных модификаторов, --crisis без --err', () => {
    const nav = top.indexOf('.ds-card--nav {');
    expect(nav).toBeGreaterThan(-1);
    expect(nav).toBeLessThan(top.indexOf('.ds-card--panel'));
    expect(nav).toBeLessThan(top.indexOf('.ds-card--accent'));
    const crisis = decls(top, '.ds-card--crisis');
    expect(crisis).toContain('--h: 28');
    expect(crisis).not.toContain('var(--err)');
  });
  it('.ds-link: тап 44 на телефоне и под пальцем, не у мыши; один телефонный блок', () => {
    expect(decls(tap, '.ds-link')).toContain('min-height: 44px');
    expect(decls(top, '.ds-link')).not.toContain('min-height');
    expect(css.match(/@media \(max-width: 767px\), \(pointer: coarse\) and \(max-height: 500px\)/g)).toHaveLength(1);
  });
  it('.ds-link--inline: объявлен один раз вне медиа, под пальцем остаётся в строке текста', () => {
    expect(declaredTimes('.ds-link--inline')).toBe(1);
    expect(decls(top, '.ds-link--inline')).toContain('display: inline');
    expect(decls(tap, '.ds-link--inline')).toContain('display: inline');
    expect(decls(tap, '.ds-link--inline')).toContain('min-height: 0');
  });
});

describe('cabinet.css: примитивы волны 3 (#906)', () => {
  const WAVE3 = ['.ds-link--danger', '.ds-input--on-panel', '.ds-menu', '.ds-menu-item', '.ds-backdrop'];
  it.each(WAVE3)('%s объявлен один раз вне медиа и красится токенами', (cls) => {
    expect(declaredTimes(cls)).toBe(1);
    expect(decls(css, cls)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
  it('разделитель строк списка — --paper-sunk (заливка-линия), --line только контуры; пунктира нет', () => {
    expect(decls(top, '.ds-list-row')).toContain('border-bottom: 1px solid var(--paper-sunk)');
    expect(decls(top, 'button.ds-list-row')).toContain('border-bottom: 1px solid var(--paper-sunk)');
    expect(css).not.toMatch(/border[a-z-]*:[^;}]*dashed/);
  });
  it('меню «⋯»: fixed с тенью --shadow-2, пункт 44 только под пальцем, опасный — --err', () => {
    expect(decls(top, '.ds-menu')).toContain('position: fixed');
    expect(decls(top, '.ds-menu')).toContain('box-shadow: var(--shadow-2)');
    expect(decls(tap, '.ds-menu-item')).toContain('min-height: 44px');
    expect(decls(phone, '.ds-menu-item')).toBe('');
    expect(decls(top, '.ds-menu-item.is-danger')).toContain('color: var(--accent-red)');
    expect(decls(top, '.ds-backdrop')).toContain('position: fixed');
  });
  it('опасное действие: ссылка и заголовок строки красятся --accent-red', () => {
    expect(decls(top, '.ds-link--danger')).toContain('color: var(--accent-red)');
    expect(decls(top, '.ds-link--danger:hover')).toContain('color: var(--accent-red)');
    expect(decls(top, '.ds-list-row--danger .ds-list-title')).toContain('color: var(--accent-red)');
  });
  it('поле на песочной панели: белая бумага с контуром --panel-line, объявлено после .ds-input:focus', () => {
    const f = decls(top, '.ds-input--on-panel');
    expect(f).toContain('background: var(--surface)');
    expect(f).toContain('border-color: var(--panel-line)');
    expect(f).toContain('color: var(--text)');
    expect(top.indexOf('.ds-input--on-panel {')).toBeGreaterThan(top.indexOf('.ds-input:focus'));
  });
});

describe('cabinet.css: компьютер ≥768 (регрессия 2026-11-04 «кабинет стал как телефон»)', () => {
  it('шапка страницы на компьютере — без полосы: без линии и фона, min-height 0, колонка из --sheet-col', () => {
    const d = decls(desk, '.ds-sheet-head--page');
    expect(d).toContain('border-bottom: none');
    expect(d).toContain('background: none');
    expect(d).toContain('min-height: 0');
    expect(d).toContain('max-width: var(--sheet-col)');
    expect(d).not.toMatch(/var\([^)]*,/); // фолбэков в var() нет
    expect(decls(css, ':root')).toContain('--sheet-col');
  });
  it('на телефоне модификатор --page ничего не меняет: правила для него нет вне ≥768', () => {
    expect(top + phone).not.toContain('.ds-sheet-head--page');
  });
});
