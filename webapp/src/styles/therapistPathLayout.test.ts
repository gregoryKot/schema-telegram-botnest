// @vitest-environment node
// Раскладка «По фазам» по исходникам css: колонка фазы вмещает строку пункта, лента не режет колонку, меню не шире экрана.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseRules } from './cssRules.test-helpers';

const read = (f: string) => parseRules(fs.readFileSync(path.resolve(__dirname, f), 'utf8'));
const pathCss = read('therapist-path.css');
const tabsCss = read('therapist-tabs.css');
const body = (rules: ReturnType<typeof parseRules>, sel: string, media: (m: string) => boolean) =>
  rules.filter((r) => r.selectors.includes(sel) && media(r.media)).map((r) => r.body).join(';');
const px = (text: string, re: RegExp) => Number(re.exec(text)?.[1] ?? Number.NaN);
const wide = (m: string) => m.startsWith('@container ph');

/** Тап-цель иконки и ширина кнопки «В фазу…» (поля 18+18 и текст) на касании — cabinet.css. */
const ICON = 44, PHASE_BTN = 96, ROW_GAP = 8;

describe('«По фазам»: раскладка', () => {
  const track = body(pathCss, '.ph-track', wide);

  it('широкая колонка вкладки: фазы в сетке с переносом, без горизонтальной прокрутки', () => {
    expect(track).toMatch(/display:\s*grid/);
    expect(track).toMatch(/repeat\(auto-fill,\s*minmax\(\d+px,\s*1fr\)\)/);
    expect(pathCss.filter((r) => r.selectors.includes('.ph-track')).map((r) => r.body).join(';')).not.toMatch(/overflow-x|nowrap/);
  });

  it('в самую узкую колонку влезает строка пункта: статус, «В фазу…», две иконки', () => {
    const column = px(track, /minmax\((\d+)px/);
    const pad = px(body(pathCss, '.ph-card', (m) => m === ''), /padding:\s*\d+px\s+(\d+)px/);
    const status = px(body(tabsCss, '.pl-status', (m) => m === ''), /min-width:\s*(\d+)px/);
    expect(column - 2 * pad).toBeGreaterThanOrEqual(status + ROW_GAP + PHASE_BTN + 2 * ICON);
  });

  it('узкая фаза: статус и действия одной строкой, текст — на всю ширину под ними', () => {
    expect(body(pathCss, '.ph-card .pl-item', (m) => m === '')).toMatch(/flex-wrap:\s*wrap/);
    expect(body(pathCss, '.ph-card .pl-body', (m) => m === '')).toMatch(/flex-basis:\s*100%/);
  });

  it('крайние пункты фазы не добавляют пустой отступ', () => {
    expect(body(pathCss, '.ph-items > .pl-item:last-child', (m) => m === '')).toMatch(/padding-bottom:\s*0/);
  });

  it('меню «В фазу…» — по содержимому и не шире экрана', () => {
    const menu = body(tabsCss, '.ds-menu.pl-menu', (m) => m === '');
    expect(menu).toMatch(/width:\s*max-content/);
    expect(menu).toMatch(/max-width:\s*min\(\d+px,\s*calc\(100vw - 16px\)\)/);
  });
});
