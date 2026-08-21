// Регрессионный тест на a11y-аудит 2026-08 (главная страница webapp, узлы
// «Выйти» в сайдбаре и «⌘K» в .kbd — axe color-contrast, serious).
//
// Оба узла сидят не на чистом --bg/--bg-rail, а на композите из нескольких
// полупрозрачных слоёв (--kbd рисуется поверх дважды наложенной --surface-2
// внутри .search-pill), поэтому обычных --text-faint/--c-rose там не хватало
// (3.12:1 и 4.46:1 при требуемых 4.5:1). Тест пересчитывает контраст токенов
// --c-rose-strong/--kbd-text против ТЕХ ЖЕ композитных фонов, что в проде —
// чтобы правку нельзя было тихо откатить к слишком светлому значению.
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CSS = readFileSync(join(__dirname, 'index.css'), 'utf8');

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Разбирает и `#rrggbb`, и `rgba(r,g,b,a)` — оба формата встречаются в index.css.
function parseColor(raw: string): { rgb: Rgb; alpha: number } {
  const v = raw.trim();
  const rgbaMatch = v.match(/rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbaMatch) {
    return { rgb: [+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]], alpha: +rgbaMatch[4] };
  }
  return { rgb: hexToRgb(v), alpha: 1 };
}

/** Значение токена в конкретном блоке темы (`:root, html[data-theme="light"]`
 *  либо `html[data-theme="dark"]`) — берём ПЕРВОЕ совпадение внутри блока,
 *  а не по всему файлу, иначе light/dark значения одного имени перепутаются. */
function tokenInBlock(blockCss: string, name: string): string {
  const re = new RegExp(`${name}:\\s*([^;]+);`);
  const m = blockCss.match(re);
  if (!m) throw new Error(`токен ${name} не найден в блоке темы`);
  return m[1];
}

function extractBlock(css: string, startMarker: string): string {
  const start = css.indexOf(startMarker);
  if (start === -1) throw new Error(`маркер блока «${startMarker}» не найден в index.css`);
  const openBrace = css.indexOf('{', start);
  const closeBrace = css.indexOf('\n}', openBrace);
  return css.slice(openBrace, closeBrace);
}

function srgbToLin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
/** Накладывает полупрозрачный цвет на непрозрачную подложку (alpha-composite). */
function overlay(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as Rgb;
}

const LIGHT = extractBlock(CSS, ':root, html[data-theme="light"]');
const DARK = extractBlock(CSS, 'html[data-theme="dark"]');

describe('a11y: цвета токенов --kbd-text / --c-rose-strong держат ≥4.5:1', () => {
  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('.kbd (⌘K) на реальном сложенном фоне — тема %s', (_label, block) => {
    // Реальный фон .kbd = .search-pill (--surface-2 поверх --bg) + собственный
    // --surface-2 самого .kbd поверх этого — те же два наложения, что в CSS.
    const bg = parseColor(tokenInBlock(block, '--bg')).rgb;
    const surface2 = parseColor(tokenInBlock(block, '--surface-2'));
    const searchPillBg = overlay(surface2.rgb, surface2.alpha, bg);
    const kbdBg = overlay(surface2.rgb, surface2.alpha, searchPillBg);

    const kbdText = parseColor(tokenInBlock(block, '--kbd-text'));
    const kbdFg = overlay(kbdText.rgb, kbdText.alpha, kbdBg);

    expect(contrastRatio(kbdFg, kbdBg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('кнопка «Выйти» на --bg-rail сайдбара — тема %s', (_label, block) => {
    const bgRail = parseColor(tokenInBlock(block, '--bg-rail')).rgb;
    const roseStrongRaw = tokenInBlock(block, '--c-rose-strong');
    // В тёмной теме --c-rose-strong объявлен как `var(--c-rose)` — резолвим
    // ссылку тем же парсером блока, а не хардкодим значение отдельно.
    const resolved = roseStrongRaw.trim().startsWith('var(')
      ? tokenInBlock(block, roseStrongRaw.trim().slice(4, -1))
      : roseStrongRaw;
    const roseStrong = parseColor(resolved);
    const fg = overlay(roseStrong.rgb, roseStrong.alpha, bgRail);

    expect(contrastRatio(fg, bgRail)).toBeGreaterThanOrEqual(4.5);
  });
});
