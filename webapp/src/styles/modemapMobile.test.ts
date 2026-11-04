// @vitest-environment node
// Холст «Карта режимов» на телефоне (#906, волна 1). На ноутбуке высоту холсту
// даёт цепочка flex от .therapist-sheet (index.css, ≥768); на телефоне страница
// течёт блоком, .mm2-fill { height: 100% } и .mm2-body { flex: 1 } наследовали
// auto, и вкладка была пустой — ни холста, ни тулбара, ни пустого состояния.
// CSS в jsdom не исполняется, поэтому сверяем строки sheet-modemap.css: на
// телефоне .mm2-body получает явную высоту (не min-height — проценты внутри
// считаются только от height) из 100dvh за вычетом навигации и safe-area,
// ноутбук не тронут, а переменные, от которых идёт расчёт, объявлены в :root.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Rule { group: string | null; selectors: string[]; body: string }

/** Плоский список правил с именем охватывающей @-группы (@media и т.п.). */
function parse(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const groups: string[] = [];
  let head = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const sel = head.trim();
      head = '';
      if (sel.startsWith('@') && !sel.startsWith('@font-face')) { groups.push(sel); continue; }
      const end = src.indexOf('}', i);
      out.push({ group: groups[groups.length - 1] ?? null, selectors: sel.split(',').map((s) => s.trim()), body: src.slice(i + 1, end) });
      i = end;
    } else if (ch === '}') groups.pop();
    else head += ch;
  }
  return out;
}

/** Значения свойства `prop` во всех правилах селектора `sel` внутри группы `group` (в порядке файла). */
function values(rules: Rule[], group: string | null, sel: string, prop: string): string[] {
  return rules
    .filter((r) => r.group === group && r.selectors.includes(sel))
    .flatMap((r) => r.body.split(';'))
    .map((d) => d.trim())
    .filter((d) => d.startsWith(prop + ':'))
    .map((d) => d.slice(prop.length + 1).trim());
}

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const PHONE = '@media (max-width: 767px)';
const modemap = parse(read('sheet-modemap.css'));

describe('холст карты режимов на телефоне (sheet-modemap.css)', () => {
  it('.mm2-body на ≤767 — flex: none и явная height из 100dvh минус статус-бар, нижняя навигация и safe-area', () => {
    expect(values(modemap, PHONE, '.mm2-body', 'flex')).toEqual(['none']);
    const heights = values(modemap, PHONE, '.mm2-body', 'height');
    expect(heights.some((h) => h.includes('100dvh'))).toBe(true);
    expect(values(modemap, PHONE, '.mm2-body', 'min-height')).toEqual([]);
    const chrome = values(modemap, PHONE, '.mm2-body', '--mm2-chrome').join('');
    for (const token of ['var(--mm2-top', 'var(--safe-bottom)', 'var(--mobile-nav-h)']) expect(chrome).toContain(token);
    expect(heights.every((h) => h.includes('var(--mm2-chrome)'))).toBe(true);
  });

  it('запасной вариант на 100vh стоит перед 100dvh (браузер без dvh берёт первый, с dvh — второй)', () => {
    const heights = values(modemap, PHONE, '.mm2-body', 'height');
    expect(heights.findIndex((h) => h.includes('100vh'))).toBeLessThan(heights.findIndex((h) => h.includes('100dvh')));
  });

  it('ноутбук не тронут: вне медиа-блока .mm2-fill — height: 100%, .mm2-body — flex: 1 без своей высоты', () => {
    expect(values(modemap, null, '.mm2-fill', 'height')).toEqual(['100%']);
    expect(values(modemap, null, '.mm2-body', 'flex')).toEqual(['1']);
    expect(values(modemap, null, '.mm2-body', 'height')).toEqual([]);
  });

  it('пустое состояние и скелетон заполняют холст: .mm2-center растёт от 100% на телефоне, .mm2-skel — height: 100%', () => {
    expect(values(modemap, PHONE, '.mm2-center', 'min-height')).toEqual(['100%']);
    expect(values(modemap, PHONE, '.mm2-center', 'height')).toEqual(['auto']);
    expect(values(modemap, PHONE, '.mm2-body', 'overflow')).toEqual(['auto']);
    expect(values(modemap, null, '.mm2-skel', 'height')).toEqual(['100%']);
    expect(values(modemap, null, '.mm2-skel-bar', 'position')).toEqual(['absolute']);
  });

  it('переменные расчёта объявлены в :root index.css (--mobile-nav-h, --safe-top, --safe-bottom)', () => {
    const root = parse(read('../index.css')).filter((r) => r.group === null && r.selectors.includes(':root')).map((r) => r.body).join(';');
    for (const v of ['--mobile-nav-h', '--safe-top', '--safe-bottom']) expect(root, v).toMatch(new RegExp(`(^|;)\\s*${v}:`));
  });

  it('пункт общего меню Dropdown (.mm2-item) на ≤767 — тап-цель 44, одним правилом для всех меню «⋯»', () => {
    expect(values(modemap, PHONE, '.mm2-item', 'min-height')).toEqual(['44px']);
  });

  it('цвета новых правил — токенами, без hex/rgb-литералов', () => {
    const fresh = modemap.filter((r) => r.group === PHONE || r.selectors.some((s) => s.startsWith('.mm2-skel')));
    expect(fresh.length).toBeGreaterThan(0);
    for (const r of fresh) expect(r.body, r.selectors.join(',')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('поля холста на ≤767 — 16px (iOS не увеличивает экран при фокусе), на ноутбуке прежние', () => {
    const sels = ['.mm2-pal-search .ds-input', '.mm2-add-form .ds-input', '.mm2-panel .ds-input', '.mm2-panel .ds-textarea',
      '.mm2-panel select.ds-input', '.ds-input.mm2-add-emoji', '.ds-input.mm2-lane-input'];
    for (const sel of sels) expect(values(modemap, PHONE, sel, 'font-size'), sel).toEqual(['16px']);
    expect(values(modemap, null, '.mm2-pal-search .ds-input', 'font-size')).toEqual(['12.5px']);
    expect(values(modemap, null, '.mm2-panel .ds-input', 'font-size')).toEqual(['13px']);
  });
});
