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
import { contrastRatio, extractBlock, luminance, overlay, parseColor, resolveToken, tokenInBlock } from './test-support/cssContrast';

const CSS = readFileSync(join(__dirname, 'index.css'), 'utf8');

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
    // В тёмной теме --c-rose-strong объявлен как `var(--c-rose)` — резолвим
    // ссылку тем же парсером блока, а не хардкодим значение отдельно.
    const roseStrong = parseColor(resolveToken(block, '--c-rose-strong'));
    const fg = overlay(roseStrong.rgb, roseStrong.alpha, bgRail);

    expect(contrastRatio(fg, bgRail)).toBeGreaterThanOrEqual(4.5);
  });
});

// Пара «залитый красный + текст на нём» — роль «опасность» (кнопки «Снять
// роль», «Да, удалить всё навсегда», баннер офлайна). Белый текст здесь жил
// захардкоженным литералом `#fff` и в тёмной теме давал 2.78:1: тёмная тема
// осветляет красный, а литерал остаётся белым. Отсюда токен --on-accent-red
// (белый в светлой теме, тёплые ночные чернила в тёмной) — и этот тест,
// который считает контраст ПАРЫ из самих токенов: поменяешь --accent-red
// (или заведёшь третью тему) — числа пересчитаются сами, а не останутся
// в комментарии.
describe('a11y: текст на залитом --accent-red держит ≥4.5:1 в обеих темах', () => {
  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('--on-accent-red на --accent-red — %s', (_label, block) => {
    const fill = parseColor(resolveToken(block, '--accent-red'));
    const ink = parseColor(resolveToken(block, '--on-accent-red'));

    expect(fill.alpha).toBe(1); // заливка обязана быть непрозрачной
    expect(contrastRatio(ink.rgb, fill.rgb)).toBeGreaterThanOrEqual(4.5);
  });
});

// Пара «залитый --accent визитки + текст на нём». Белый на светлом индиго
// проходит (7.85:1), а в тёмной теме индиго осветляется до #9089e0, и тот же
// белый давал 3.07:1 — ниже AA. Читаем значения из index.css, не дублируем.
describe('a11y: .landing-personal-brand — текст на залитом --accent ≥4.5:1', () => {
  const LIGHT_BRAND = extractBlock(CSS, '.landing-personal-brand {');
  const DARK_BRAND = extractBlock(CSS, 'html[data-theme="dark"] .landing-personal-brand');

  it.each([
    ['light', LIGHT_BRAND],
    ['dark', DARK_BRAND],
  ] as const)('--on-accent на --accent — тема %s', (_label, block) => {
    const fill = parseColor(resolveToken(block, '--accent'));
    const ink = parseColor(resolveToken(block, '--on-accent'));

    expect(fill.alpha).toBe(1);
    expect(contrastRatio(ink.rgb, fill.rgb)).toBeGreaterThanOrEqual(4.5);
  });
});

// Опасные действия (ds-link--danger, ds-list-row--danger, ds-menu-item.is-danger)
// красятся --accent-red: у него есть тёмный вариант. Страницы вне AppShell
// (/account) бывают в тёмной теме, а --err определён только в светлой: на тёмных
// --bg/--surface он давал 3.11:1 и 2.84:1.
describe('a11y: красный текст опасных действий на --bg и --surface ≥4.5:1 в обеих темах', () => {
  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('--accent-red на --bg и --surface — тема %s', (_label, block) => {
    const fg = parseColor(resolveToken(block, '--accent-red'));
    for (const bgToken of ['--bg', '--surface']) {
      const bg = parseColor(resolveToken(block, bgToken));
      expect(contrastRatio(fg.rgb, bg.rgb), bgToken).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('опасные правила cabinet.css не берут --err (нет тёмного варианта)', () => {
    const cabinet = readFileSync(join(__dirname, 'styles', 'cabinet.css'), 'utf8');
    const bad = [...cabinet.matchAll(/([^{}]*danger[^{}]*)\{([^{}]*)\}/g)].filter((m) => /var\(--err\)/.test(m[2])).map((m) => m[1].trim());
    expect(bad).toEqual([]);
  });
});

// Песочная панель (2026-11): сайдбар, нижняя навигация, герой входа и оплаты,
// вводные карточки — до того почти чёрный «ink» редизайна 2026-10, который
// владелец снял («чёрный тяжёлый, добавляет тяжести»). Панель светлая, и
// текст на ней — те же чернила, что на бумаге; этот тест держит пары
// «текст на панели» на ≥4.5:1, чтобы --panel нельзя было тихо затемнить или
// осветлить так, что подписи сайдбара и нижней навигации (--on-panel-faint)
// или «Выйти» (--on-panel-danger) поплывут. Панель только в светлой теме:
// кабинет под .light-lock, тёмная панель не объявлена.
describe('a11y: текст на песочной --panel держит ≥4.5:1', () => {
  it.each([
    ['--on-panel', '--panel'],
    ['--on-panel', '--panel-2'],
    ['--on-panel', '--panel-3'],
    ['--on-panel-sub', '--panel'],
    ['--on-panel-sub', '--panel-2'],
    ['--on-panel-faint', '--panel'],
    ['--on-panel-faint', '--panel-2'],
    ['--on-panel-danger', '--panel'],
    ['--on-panel-danger', '--panel-2'],
    // Счётчик активного пункта сайдбара (.sb-item.is-active .badge): до
    // 2026-11-05 красился --accent-hot (декор-токен) — 2.85:1 на --panel-3.
    ['--accent', '--panel-3'],
  ])('%s на %s', (fgName, bgName) => {
    const fg = parseColor(resolveToken(LIGHT, fgName)).rgb;
    const bg = parseColor(resolveToken(LIGHT, bgName)).rgb;
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('панель светлее чернил и темнее бумаги: это плашка на бумаге, а не второй чёрный', () => {
    const panel = luminance(parseColor(resolveToken(LIGHT, '--panel')).rgb);
    const paper = luminance(parseColor(resolveToken(LIGHT, '--bg')).rgb);
    const ink = luminance(parseColor(resolveToken(LIGHT, '--text')).rgb);
    expect(panel).toBeLessThan(paper);
    expect(panel).toBeGreaterThan(0.5);
    expect(ink).toBeLessThan(0.1);
  });
});
