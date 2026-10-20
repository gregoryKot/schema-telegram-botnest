// @vitest-environment jsdom
// Общий лист «Настроить экран» для «Профиля» и «Паттернов»: строки из реестра блоков, тумблер, ручка, подсветка.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScreenCustomizeSheet, type ScreenBlocksApi } from './ScreenCustomizeSheet';

vi.mock('../useIsMobile', () => ({ useIsMobile: () => true }));
afterEach(cleanup);

function setup(over: Partial<ScreenBlocksApi> = {}) {
  const blocks: ScreenBlocksApi = {
    hidden: ['heroes'],
    orderedIds: ['heroes', 'ysq_status'],
    toggle: vi.fn(),
    reorder: vi.fn(() => true),
    closeSheet: vi.fn(),
    ...over,
  };
  render(<MemoryRouter><ScreenCustomizeSheet blocks={blocks} /></MemoryRouter>);
  return blocks;
}

describe('ScreenCustomizeSheet', () => {
  it('строка на каждый блок: скрытый — выключен, видимый — включён', () => {
    setup();
    expect(screen.getByRole('switch', { name: 'Подсказка сверху' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Тест на схемы' }).getAttribute('aria-checked')).toBe('true');
  });

  it('тумблер зовёт toggle с id блока', () => {
    const blocks = setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Тест на схемы' }));
    expect(blocks.toggle).toHaveBeenCalledWith('ysq_status');
  });

  it('ручка на клавиатуре зовёт reorder', () => {
    const blocks = setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Переставить: Тест на схемы' }), { key: 'ArrowUp' });
    expect(blocks.reorder).toHaveBeenCalledWith('ysq_status', 0);
  });

  it('блок без описания в реестре не рисуется, подсвеченный — выделен', () => {
    setup({ orderedIds: ['heroes', 'ysq_status', 'focus'], highlight: 'ysq_status' });
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(document.querySelector('.cz-block.is-hl')?.textContent).toContain('Тест на схемы');
  });
});
