// @vitest-environment node
// Описание плитки «Практик» (ExerciseTile: на телефоне — только у не начатого упражнения) — ответ новичку «откуда
// это и зачем» до первого нажатия. Ревью g4 r5: на телефоне оно резалось многоточием (line-clamp 2, 3 на ≤359) —
// на 390 «Слова поддержки — перечитать, когда…», в пустом разделе обрезаны 5 описаний из 8. Описание целиком:
// ни одно правило .cp-ex-desc не обрезает его (line-clamp, overflow, max-height). Проверка на живой вёрстке
// 320/360/390 (scrollHeight ≤ clientHeight у каждого описания) — зонд стенда, снимки b14-practice-empty-*.
import { describe, it, expect } from 'vitest';
import { readCss } from './cssRules.test-helpers';

const CLIP = /(?:^|;)\s*(-webkit-line-clamp|line-clamp|overflow|max-height|text-overflow)\s*:/;

describe('описание плитки «Практик» — целиком', () => {
  const desc = readCss('client-practice.css').filter((r) => r.selectors.some((s) => /\.cp-ex-desc(?![\w-])/.test(s)));

  it('правила описания есть (телефон и компьютер) — сверка не пустая', () => {
    expect(desc.some((r) => r.selectors.some((s) => s.includes('.cp-page--phone')))).toBe(true);
    expect(desc.length).toBeGreaterThan(1);
  });

  it('ни одно правило .cp-ex-desc не обрезает текст', () => {
    expect(desc.filter((r) => CLIP.test(r.body)).map((r) => `${r.media} ${r.selectors.join(', ')} { ${r.body.trim()} }`)).toEqual([]);
  });

  it('контрольный образец: обрезку в строке правила сверка ловит', () => {
    expect(CLIP.test('display: -webkit-box; -webkit-line-clamp: 2; overflow: hidden;')).toBe(true);
    expect(CLIP.test('margin-top: 2px; font-size: 13px; line-height: 1.4;')).toBe(false);
  });
});
