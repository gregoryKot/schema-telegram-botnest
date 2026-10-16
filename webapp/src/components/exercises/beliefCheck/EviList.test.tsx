// @vitest-environment jsdom
// Кнопка удаления доказательства в «Проверке убеждения» (сайт). Видимость на
// телефоне RTL не доказывает — jsdom не применяет @media (hover: none); её
// держит гейт check-hover-only-reveal.mjs. Здесь — что кнопка находится по
// роли и имени и зовёт onRemove с индексом своей строки, и геометрия зоны
// нажатия из index.css: раскладку jsdom не считает, гейт тап-целей CSS-классы
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

const CSS = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
const TOKENS = readFileSync(
  resolve(__dirname, '../../../../../shared/src/theme/tokens.css'),
  'utf8',
);
/** Объявления первого правила с ровно этим селектором в начале строки. */
function decls(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`правило «${selector}» не найдено в index.css`);
  return m[1];
}
/** Первое значение свойства в px; `var(--space-N)` разворачивается по tokens.css. */
function px(block: string, prop: string): number {
  const m = block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+)`));
  if (!m) throw new Error(`нет свойства ${prop}`);
  const v = m[1].trim();
  const token = v.match(/^var\((--[\w-]+)\)$/);
  const raw = token
    ? TOKENS.match(new RegExp(`${token[1]}:\\s*(-?[\\d.]+)px`))?.[1]
    : v.match(/^(-?[\d.]+)px/)?.[1];
  if (raw === undefined) throw new Error(`${prop}: «${v}» не в px`);
  return Number(raw);
}

describe('EviList — зона нажатия «×» (index.css)', () => {
  it('видимый кружок мелкий, зона нажатия не меньше 44×44', () => {
    const size = px(decls('.evi-x'), 'width');
    const reach = -px(decls('.evi-x::before'), 'inset');
    expect(px(decls('.evi-x'), 'height')).toBe(size);
    expect(size + 2 * reach).toBeGreaterThanOrEqual(44);
  });

  it('зона не выходит за строку по вертикали и не наползает на текст', () => {
    // Выступ не больше padding строки — тап у «×» не попадёт в кнопку
    // соседней строки; меньше gap грида — не попадёт в текст своей строки.
    const reach = -px(decls('.evi-x::before'), 'inset');
    const row = decls('.evi-row');
    expect(reach).toBeLessThanOrEqual(px(row, 'padding'));
    expect(reach).toBeLessThan(px(row, 'gap'));
  });
});
