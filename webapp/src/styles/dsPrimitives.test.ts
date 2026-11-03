// @vitest-environment node
// Общие примитивы листов телефона (#906, волна 1, срез Foundation): шапка листа
// и «Назад», полноширинная кнопка, строка-переход с одним шевроном, пустое
// состояние, раскрывашка, тап-цели 44 на телефоне. CSS в jsdom не исполняется,
// поэтому сверяем строки cabinet.css (приём safeTop.test.ts): класс объявлен,
// ключевые объявления на месте, цвета — только токенами.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const phone = block(css, '@media (max-width: 767px)');
/** Всё вне телефонного блока: там каждый примитив объявлен один раз. */
const top = css.replace(phone, '');

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

  it('на телефоне: иконочная кнопка 44×44, сегмент 44 высотой, ds-h1 32 и компактный 26', () => {
    expect(phone).not.toBe('');
    expect(decls(phone, '.ds-btn--icon')).toContain('width: 44px');
    expect(decls(phone, '.ds-btn--icon')).toContain('height: 44px');
    expect(decls(phone, '.ds-seg-btn')).toContain('min-height: 44px');
    expect(decls(phone, '.ds-h1')).toContain('font-size: 32px');
    expect(decls(phone, '.ds-h1--compact')).toContain('font-size: 26px');
  });
});
