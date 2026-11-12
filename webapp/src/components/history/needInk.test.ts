// @vitest-environment node
// Цвет данных потребности в истории (needInk.ts, решение 7 «Палитра данных»): число строки —
// текст на белой строке (≥4.5:1), крупная цифра карточки недели — на бумаге своей потребности
// (крупный текст, ≥3:1); графика — needDataColor, его сверка с NEED_DATA_PAPER — needDataColor.test.ts.
// Кабинет рисуется в светлой теме (needDataContrast.test.ts) — значения берём из неё.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEED_TEXT_INK, inkVars } from './needInk';
import { needDataColor } from '../needDataColor';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { contrastRatio, extractBlock, hexToRgb, oklchRgb, resolveToken, type Rgb } from '../../test-support/cssContrast';
import { allCssRules, parseRules, type Rule } from '../../styles/cssRules.test-helpers';

const LIGHT = extractBlock(readFileSync(join(__dirname, '../../index.css'), 'utf8'), ':root, html[data-theme="light"]');
const token = (v: string): Rgb => hexToRgb(resolveToken(LIGHT, /^var\((--[a-z0-9-]+)\)$/.exec(v)![1]));

/** Бумага oklch(0.915 0.03 h) в sRGB 0–255 (формула toneHex, shared/src/theme/entityHue.ts). */
const paper = (h: number): Rgb => oklchRgb(0.915, 0.03, h);

describe('needInk — цвет потребности в истории', () => {
  it('графика — один источник с трекером: needDataColor (палитра — needDataColor.test.ts)', () => {
    NEED_ORDER.forEach((id) => expect(inkVars(id)['--need-ink']).toBe(needDataColor(id)));
  });

  it('число: ≥4.5:1 к белой строке и ≥3:1 к бумаге своей потребности', () => {
    const surface = token('var(--surface)');
    for (const id of NEED_ORDER) {
      const ink = token(NEED_TEXT_INK[id]);
      expect(contrastRatio(ink, surface), `${id} на --surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, paper(NEED_HUE[id])), `${id} на бумаге ${NEED_HUE[id]}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('число — текстовый токен (*-strong или --accent-*), не палитровый --c-* для заливок', () => {
    for (const id of NEED_ORDER) expect(NEED_TEXT_INK[id]).toMatch(/^var\(--(c-[a-z]+-strong|accent-[a-z]+)\)$/);
  });

  it('контрольный образец: палитровый --c-clay мелким текстом на белой строке не проходит', () => {
    expect(contrastRatio(token('var(--c-clay)'), token('var(--surface)'))).toBeLessThan(4.5);
  });

  it('inkVars: знакомая потребность — её цвета, незнакомая — нейтральный текст', () => {
    expect(inkVars('play')).toEqual({ '--need-ink': needDataColor('play'), '--need-text': NEED_TEXT_INK.play });
    expect(inkVars('unknown')).toEqual({ '--need-ink': 'var(--text-sub)', '--need-text': 'var(--text)' });
  });
});

// Ревью g5 r1: номер совета листа потребности (.nd-tip-n, 15px) красился --need-text на бумаге своей
// потребности — 4.08–4.38:1 при норме 4.5:1. Контракт --need-text — ≥4.5:1 только к белому, к бумаге —
// ≥3:1 для крупной цифры. Мелкий текст этим цветом стоит только на белом (селектор в ON_WHITE — осознанно),
// на бумаге — --text/--text-sub.
// .tk-need b — оценка потребности в «Обзоре» терапевта: строки на белом списке .tk-needs внутри листа соломы (b30).
// .tb-ysq-mark — «выражена» в таблице YSQ терапевта (b31): строка таблицы на белой карточке ds-card.
const ON_WHITE = new Set(['.sd-spark-score', '.ss-res-num', '.tk-need b', '.tb-ysq-mark']);
const fontPx = (body: string) => Number(body.match(/font(?:-size)?\s*:[^;]*?([\d.]+)px/)?.[1] ?? 0);
const PAPER_BG = /background(?:-color)?\s*:\s*oklch\(0\.9/;
function smallNeedTextOnPaper(rules: Rule[]): string[] {
  return rules
    .filter((r) => /(?:^|;)\s*color\s*:\s*var\(--need-text\)/.test(r.body) && fontPx(r.body) < 24)
    .filter((r) => PAPER_BG.test(r.body) || !r.selectors.every((sel) => ON_WHITE.has(sel)))
    .map((r) => `${r.f ?? ''} ${r.selectors.join(', ')}`);
}

describe('мелкий текст цветом потребности — только на белом', () => {
  it('ни одно правило styles/*.css не ставит мелкий --need-text на бумагу или неизвестный фон', () => {
    expect(smallNeedTextOnPaper(allCssRules())).toEqual([]);
  });

  it('контрольный образец: прежний номер совета краснеет; крупная цифра и номер цветом --text — нет', () => {
    const was = parseRules('.nd-tip-n { font: 400 15px var(--serif); background: oklch(0.915 0.03 var(--h)); color: var(--need-text); }');
    expect(smallNeedTextOnPaper(was)).toEqual([' .nd-tip-n']);
    expect(smallNeedTextOnPaper(parseRules('.nd-score-n { font: 400 56px/1 var(--serif); color: var(--need-text); }'))).toEqual([]);
    expect(smallNeedTextOnPaper(parseRules('.nd-tip-n { font: 400 15px var(--serif); color: var(--text); }'))).toEqual([]);
  });

  it('почему: к бумаге своей потребности --need-text ниже 4.5:1 хотя бы у одной потребности', () => {
    const worst = Math.min(...NEED_ORDER.map((id) => contrastRatio(token(NEED_TEXT_INK[id]), paper(NEED_HUE[id]))));
    expect(worst).toBeLessThan(4.5);
  });
});
