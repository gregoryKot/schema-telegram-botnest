// Экран загрузки в index.html рисует знак продукта копией разметки: до бандла
// импортировать нечего. Сверка с brandMarkSvg (правило №4): правка геометрии
// или цветов знака без index.html краснеет здесь.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brandMarkSvg } from '../../shared/src/share/kit/brandMark';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const boot = /<div id="boot">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
/** Рисунок знака без корневого <svg>: от плитки до закрытия группы. */
const drawing = (svg: string) => /<rect[\s\S]*<\/g>/.exec(svg)?.[0].replace(/\s+/g, ' ') ?? '';

describe('экран загрузки index.html', () => {
  it('стоит внутри #root: первый рендер React его заменяет', () => {
    expect(html).toMatch(/<div id="root"><div id="boot">/);
  });

  it('знак совпадает с полным знаком brandMarkSvg', () => {
    expect(drawing(boot)).not.toBe('');
    expect(drawing(boot)).toBe(drawing(brandMarkSvg()));
  });

  it('знак — декор, имя продукта — текстом', () => {
    expect(boot).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(boot).toContain('<span>Всё по схеме</span>');
  });
});
