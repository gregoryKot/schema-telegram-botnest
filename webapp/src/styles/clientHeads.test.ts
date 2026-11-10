// @vitest-environment node
// Экраны режима клиента (#906, волна 1, срез C1): шапки, кнопки, ярлыки и кегли
// собраны из примитивов cabinet.css (ds-h1, ds-sub, ds-btn--lg, ds-btn--icon,
// ds-sheet-head), локальные копии удалены. CSS в jsdom не исполняется, поэтому
// сверяем строки файлов (приём safeTop.test.ts).
import { describe, it, expect } from 'vitest';
import { cssBundle } from './cssBundle.test-helpers';
import { PHONE_MEDIA } from '../utils/phoneLayout';

// Файл вместе с частями, подключёнными через @import (раскрой 2026-11): сверка смотрит на весь раздел.
const read = (f: string) => cssBundle(f).replace(/\/\*[\s\S]*?\*\//g, '');

/** Правила файла как [селекторы, тело]; тела медиа-блоков входят, сами @media — нет. */
const rulesOf = (css: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].split(',').map((s) => s.trim()), m[2]] as const);
/** Объявления всех правил, в списке селекторов которых стоит ровно `sel`. */
const declsOf = (css: string, sel: string) =>
  rulesOf(css).filter(([sels]) => sels.includes(sel)).map(([, body]) => body.trim()).join(';');
/** Тело блока `@media (max-width: 767px)` — по балансу скобок. */
function phoneBlock(css: string): string {
  const open = css.indexOf('{', css.indexOf(`@media ${PHONE_MEDIA}`));
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    if (depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

const FILES = [
  'client-profile.css', 'client-profile-mobile.css', 'client-schemas.css', 'client-practice.css',
  'practice-selfhelp.css', 'customize-head.css', 'client-why.css', 'client-more.css', 'client-diary.css', 'client-today.css',
];

describe('экраны клиента: кегли и ярлыки — из cabinet.css (#906)', () => {
  it.each(FILES)('%s: ни одно правило не задаёт кегль заголовку экрана (ds-h1 / h1)', (f) => {
    for (const [sels, body] of rulesOf(read(f))) {
      if (sels.some((s) => /ds-h1|\bh1\b/.test(s))) expect(body, sels.join(', ')).not.toMatch(/font-size|line-height/);
    }
  });

  it.each(FILES)('%s: ds-h2/ds-h3 не переопределяются капителью (ярлык — ds-label)', (f) => {
    for (const [sels, body] of rulesOf(read(f))) {
      if (sels.some((s) => /ds-h[23]/.test(s))) expect(body, sels.join(', ')).not.toMatch(/text-transform|letter-spacing|font:/);
    }
  });

  it('локальные копии кнопок и телефонных шапок удалены вместе с заменой', () => {
    const all = FILES.map(read).join('\n');
    for (const cls of ['.cz-gear', '.cpf-head-settings', '.cpf-head-desk', '.cpf-head-mob', '.cp-phone-sub', '.cw-cta', '.cm-sos', '.cm-h1', '.cs-add', '.cp-page--phone .ds-h1']) {
      expect(all, cls).not.toContain(cls);
    }
  });
});

describe('экраны клиента: действия и кнопки — ds-* (#906)', () => {
  // b14: ⚠ у заголовка читался ошибкой — «Важное о самопомощи» стало тихой ссылкой ds-link со знаком
  // Limits; свой цвет предупреждения и копия иконочной кнопки не возвращаются.
  it('«Важное о самопомощи» — тихая ссылка ds-link: зона 44, без цвета предупреждения и заливки', () => {
    const css = read('practice-selfhelp.css');
    const d = declsOf(css, '.ds-link.cp-selfhelp');
    expect(d).toContain('min-height: 44px');
    expect(d).not.toMatch(/color|background|border/);
    expect(css).not.toMatch(/ds-btn--icon\.cp-selfhelp|--warn/);
  });

  it('действия шапок «Профиль», «Паттерны», «Практика» — группа справа, при нехватке места второй строкой', () => {
    expect(declsOf(read('client-profile.css'), '.cpf-head')).toContain('flex-wrap: wrap');
    expect(declsOf(read('client-profile.css'), '.cpf-head-actions')).toContain('margin-left: auto');
    expect(declsOf(read('client-schemas.css'), '.cs-head-actions')).toContain('margin-left: auto');
    expect(declsOf(read('practice-selfhelp.css'), '.cp-head-row')).toContain('flex-wrap: wrap');
    expect(declsOf(read('client-schemas.css'), '.cs-head')).not.toContain('nowrap');
  });

  it('«Записать» — ds-btn--lg во всю ширину на телефоне, пилюля по тексту только от 768px', () => {
    const css = read('client-diary.css');
    expect(declsOf(css, '.cd-write')).not.toMatch(/min-height|border-radius/);
    expect(css).toMatch(/@media \(min-width: 768px\) and \(min-height: 501px\), \(min-width: 768px\) and \(pointer: fine\) \{ \.cd-write \{ width: auto/);
    expect(phoneBlock(css)).not.toContain('.cd-write');
  });

  it('плитки «Сегодня» — радиус по шкале (20)', () => {
    expect(declsOf(read('client-today.css'), '.ct-tile')).toContain('border-radius: 20px');
  });
});

describe('лист «Зачем это всё» (client-why.css)', () => {
  const css = read('client-why.css');
  it('шапка листа — ds-sheet-head во всю ширину; одинокий «← Закрыть» держит примитив, локального правила нет', () => {
    expect(declsOf(css, '.cw-head')).toContain('width: 100%');
    expect(css).not.toMatch(/\.cw-head > \.ds-back/);
    expect(declsOf(css, '.cw-sheet')).toContain('flex-direction: column');
  });
  it('отступ на --safe-top даёт .u-sheet (shared/theme/utilities.css), своего padding-top у .cw-sheet нет', () => {
    expect(css).not.toMatch(/\.cw-sheet \{[^}]*padding-top/);
  });
  // b05 (редизайн 2026-11): три действия — листы бумаги оттенков главной, а не строки белой карточки.
  it('три действия — листы бумаги со знаком в углу; строк ds-list-row и белой карточки больше нет', () => {
    expect(declsOf(css, '.cw-thing')).toContain('grid-template-columns');
    expect(declsOf(css, '.cw-thing > .pp-art')).toContain('grid-column: 2');
    expect(css).not.toMatch(/\.cw-item|\.cw-list|\.cw-hero/);
  });
});
