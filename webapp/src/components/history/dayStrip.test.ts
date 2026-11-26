// @vitest-environment node
// Лента дат истории (dayStrip.ts + history.css): затухает только тот край, за которым есть дни, а
// семь дней на телефоне 390 встают целиком — иначе лента шире себя на поле под тень, и седьмой день
// затухал, обещая дни, которых нет (ревью g2). CSS в jsdom не исполняется — сверка по исходнику.
import { describe, it, expect } from 'vitest';
import { stripEdges } from './dayStrip';
import { readCss } from '../../styles/cssRules.test-helpers';

const base = readCss('history.css').filter((r) => r.media === '');
function decl(selector: string, prop: string): string {
  const rule = base.find((r) => r.selectors.includes(selector) && new RegExp(`(^|;)\\s*${prop}:`).test(r.body));
  const m = rule && new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`).exec(rule.body);
  if (!m) throw new Error(`${selector} { ${prop} } не найден в history.css`);
  return m[1].trim();
}
const px = (v: string) => (v === '0' ? 0 : Number(/^(-?[\d.]+)px$/.exec(v)![1]));

describe('stripEdges', () => {
  it('затухает только тот край, за которым есть дни', () => {
    expect(stripEdges(0, 358, 900)).toEqual({ start: false, end: true });
    expect(stripEdges(200, 358, 900)).toEqual({ start: true, end: true });
    expect(stripEdges(542, 358, 900)).toEqual({ start: true, end: false });
    expect(stripEdges(0, 358, 358)).toEqual({ start: false, end: false });
    expect(stripEdges(0.3, 358, 358.4)).toEqual({ start: false, end: false });
  });
});

describe('лента дат: 7 дней на 390', () => {
  // Колонка на 390: поля .sd-history clamp(16px, 4vw, 32px) → 16 с каждой стороны.
  const client = 390 - 2 * 16;
  const gap = px(decl('.sd-days', 'gap'));
  const padRight = px(decl('.sd-days', 'padding').split(/\s+/)[1] ?? '0px');
  const tail = px(decl('.sd-days > :last-child', 'margin-right'));
  const minDay = px(decl('.sd-day', 'min-width'));
  const basisCut = px(/calc\(\(100% - ([\d.]+px)\) \/ 7\)/.exec(decl('.sd-day', 'flex'))![1]);

  it('листок не уже тап-цели 44', () => expect(minDay).toBeGreaterThanOrEqual(44));

  it('семь листков, зазоры и поле под тень помещаются в ленту — затухания нет', () => {
    const content = client - padRight;
    const day = Math.max(minDay, (content - basisCut) / 7);
    const scroll = 7 * day + 6 * gap + tail + padRight;
    expect(scroll).toBeLessThanOrEqual(client + 0.5);
    expect(stripEdges(0, client, scroll)).toEqual({ start: false, end: false });
  });

  it('контрольный образец: старая лента (padding-right 4, листок от 46) выходила на 4px шире', () => {
    const day = Math.max(46, (client - 4 - 40) / 7);
    expect(stripEdges(0, client, 7 * day + 36 + 4).end).toBe(true);
  });
});
