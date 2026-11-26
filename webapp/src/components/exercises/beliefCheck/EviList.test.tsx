// @vitest-environment jsdom
// Кнопка удаления доказательства в «Проверке убеждения» (сайт). Видимость на
// телефоне RTL не доказывает — jsdom не применяет @media (hover: none); её
// держит гейт check-hover-only-reveal.mjs. Здесь — что кнопка находится по
// роли и имени и убирает свою строку (с окном «Отменить»), и геометрия зоны
// нажатия из ex-belief.css: раскладку jsdom не считает, гейт тап-целей CSS-классы
// не видит — без пина зону можно тихо ужать или вывести в соседнюю строку.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { EviList } from './EviList';
import { UNDO_WINDOW_MS } from '../../../../../shared/src/hooks/useUndoRemove';

afterEach(cleanup);

function Harness({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  return (
    <EviList items={items} setItems={setItems} input="" onInput={() => {}} onAdd={() => {}} placeholder="Добавить" />
  );
}

const rows = () => [...document.querySelectorAll('.ex2-evi-text')].map((n) => n.textContent);

describe('EviList — удаление', () => {
  it('кнопка «Удалить» каждой строки убирает именно свою строку', () => {
    render(<Harness initial={['первое', 'второе']} />);
    const buttons = screen.getAllByRole('button', { name: 'Удалить' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(rows()).toEqual(['первое']);
  });
});

// docs/open/frontend-ux.md: доказательство стиралось одним тапом без отмены —
// промах пальцем по всегда видимому «×» означал перенабрать строку.
describe('EviList — «Отменить» 5 секунд', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('после удаления видна строка «Доказательство удалено · Отменить»; отмена возвращает строку на место', () => {
    render(<Harness initial={['первое', 'второе', 'третье']} />);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]);
    expect(rows()).toEqual(['первое', 'третье']);
    expect(screen.getByRole('status').textContent).toContain('Доказательство удалено');
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(rows()).toEqual(['первое', 'второе', 'третье']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('через 5 секунд строка отмены уходит, удаление остаётся', () => {
    render(<Harness initial={['первое', 'второе']} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    act(() => { vi.advanceTimersByTime(UNDO_WINDOW_MS - 1); });
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    expect(rows()).toEqual(['второе']);
  });
});

const CSS = readFileSync(resolve(__dirname, '../../../styles/ex-belief.css'), 'utf8');
/** Объявления первого правила с ровно этим селектором в начале строки. */
function decls(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`правило «${selector}» не найдено в ex-belief.css`);
  return m[1];
}
function px(block: string, prop: string): number {
  const m = block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(-?[\\d.]+)px`));
  if (!m) throw new Error(`нет свойства ${prop} в px`);
  return Number(m[1]);
}

describe('EviList — зона нажатия «×» (ex-belief.css)', () => {
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
