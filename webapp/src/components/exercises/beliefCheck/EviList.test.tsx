// @vitest-environment jsdom
// Кнопка удаления доказательства в «Проверке убеждения» (сайт). Видимость на
// телефоне RTL не доказывает — jsdom не применяет @media (hover: none); её
// держит гейт check-hover-only-reveal.mjs. Здесь — что кнопка находится по
// роли и имени и зовёт onRemove с индексом своей строки, и геометрия зоны
// нажатия из sheet-exercises.css: раскладку jsdom не считает, гейт тап-целей CSS-классы
// не видит — без пина зону можно тихо ужать или вывести в соседнюю строку.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EviList } from './EviList';

afterEach(cleanup);

describe('EviList — удаление', () => {
  it('кнопка «Удалить» каждой строки зовёт onRemove со своим индексом', () => {
    const onRemove = vi.fn();
    render(
      <EviList
        items={['первое', 'второе']}
        onRemove={onRemove}
        input=""
        onInput={() => {}}
        onAdd={() => {}}
        placeholder="Добавить"
      />,
    );
    const buttons = screen.getAllByRole('button', { name: 'Удалить' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

const CSS = readFileSync(resolve(__dirname, '../../../styles/sheet-exercises.css'), 'utf8');
/** Объявления первого правила с ровно этим селектором в начале строки. */
function decls(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`правило «${selector}» не найдено в sheet-exercises.css`);
  return m[1];
}
function px(block: string, prop: string): number {
  const m = block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(-?[\\d.]+)px`));
  if (!m) throw new Error(`нет свойства ${prop} в px`);
  return Number(m[1]);
}

describe('EviList — зона нажатия «×» (sheet-exercises.css)', () => {
  it('кнопка «×» сама не меньше 44×44 — без псевдоэлемента-хитбокса', () => {
    const block = decls('.ex2-evi-x');
    expect(px(block, 'width')).toBeGreaterThanOrEqual(44);
    expect(px(block, 'height')).toBeGreaterThanOrEqual(44);
  });

  it('кнопка видна всегда: раскрытия по hover (opacity: 0) нет', () => {
    expect(decls('.ex2-evi-x')).not.toMatch(/opacity\s*:\s*0\b/);
    expect(CSS).not.toMatch(/\.ex2-evi-x[^{]*\{[^}]*opacity\s*:\s*0\b/);
  });
});
