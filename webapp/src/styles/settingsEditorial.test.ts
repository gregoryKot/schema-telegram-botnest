// @vitest-environment node
// «Настройки» в журнальном стиле (владелец 2026-11-25: «на треть экрана и смахивают на айос»). CSS в jsdom не
// исполняется — сверяем исходники: тумблер не капсула, лист на компьютере не узкая колонка, в разделах листа
// нет шеврона «›», контурных кнопок-коробок и чипов выбора.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from './cssRules.test-helpers';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const body = (css: string, sel: string, media = '') =>
  parseRules(css).filter((r) => r.media.includes(media) && (media || !r.media) && r.selectors.includes(sel)).map((r) => r.body).join(';');

describe('тумблер .ds-switch — журнальная отметка, не iOS-капсула', () => {
  const css = read('cabinet.css');
  it('квадрат по шкале радиусов, не капсула 44×24', () => {
    const sw = body(css, '.ds-switch');
    expect(sw).toContain('border-radius: var(--r-4)');
    expect(sw).toMatch(/width: 22px; height: 22px/);
  });
  it('ручка — галка (уголок рамок), а не круглая точка, видна только у включённого', () => {
    const knob = body(css, '.ds-switch-knob');
    expect(knob).not.toContain('50%');
    expect(knob).toContain('opacity: 0');
    expect(body(css, '.ds-switch[aria-checked="true"] .ds-switch-knob')).toContain('opacity: 1');
  });
  it('зона нажатия 44×44: ::before выходит на 11px за рамку 22', () => {
    expect(body(css, '.ds-switch::before')).toContain('inset: -11px');
  });
});

describe('лист «Настройки» на компьютере — во всю ширину холста, секция — разворот', () => {
  const css = read('settings-nav.css') + read('sheet-settings.css');
  it('колонка не 680/560: потолок ≥1000 на ≥1024, вне компьютера потолка нет', () => {
    expect(css).not.toMatch(/max-width:\s*(680|560)px/);
    const cap = body(css, '.settings-content-inner', 'min-width: 1024px').match(/max-width:\s*(\d+)px/);
    expect(Number(cap?.[1])).toBeGreaterThanOrEqual(1000);
  });
  it('секция на ≥1024 — две колонки 1:2 с линией во всю ширину', () => {
    const sec = body(css, '.settings-content-inner.st-inner:not(.st-inner--sub) > .st-section', 'min-width: 1024px');
    expect(sec).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 2fr)');
    expect(sec).toContain('border-top: 1px solid var(--panel-line)');
  });
  it('оглавление без плашек: активный пункт — черта акцента, наведение не красит фон', () => {
    expect(body(css, '.settings-sidenav-item[aria-current]')).toContain('var(--accent)');
    expect(css).not.toMatch(/settings-sidenav-item[^{]*:hover\s*\{[^}]*background:\s*var/);
  });
  it('«что это?» — зона 44 по высоте, без кружка-рамки', () => {
    const help = body(css, '.st-help');
    expect(help).toContain('min-height: 44px');
    expect(help).not.toMatch(/border-radius|border: 1px/);
  });
});

describe('разделы листа без iOS-примет', () => {
  const dir = join(__dirname, '../components/settingsSheet');
  const sources = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.includes('.test') && !/Modal|Ysq|AboutSheet/.test(f));
  it.each(sources)('%s: ни шеврона «›», ни контурной кнопки-коробки, ни чипа выбора', (f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    expect(src).not.toMatch(/ds-chev\b/);
    expect(src).not.toMatch(/ds-btn--secondary(?! (st-btn-danger is-solid|st-block st-modal-close))/); // исключения — залитая «опасная» и «Закрыть» окна
    expect(src).not.toMatch(/<SignChip\b/);
  });
  it('контроль: список не пуст и включает разделы с кнопками', () => {
    expect(sources).toEqual(expect.arrayContaining(['PartnerSection.tsx', 'NotificationsSection.tsx', 'ui.tsx']));
  });
});
