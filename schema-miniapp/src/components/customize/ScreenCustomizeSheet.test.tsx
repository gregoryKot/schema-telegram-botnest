// @vitest-environment jsdom
// ScreenCustomizeSheet — generic лист «что показывать/в каком порядке» по
// экрану. Принимает готовый `blocks` (форма useScreenBlocks): рендерит блоки
// в blocks.orderedIds, клик по строке зовёт toggle(id), ручка (клавиатура)
// зовёт reorder(id, toIndex) и клэмпится на границах списка, подсветка нужной
// строки, «Готово» закрывает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  ScreenCustomizeSheet,
  type ScreenBlocksApi,
} from './ScreenCustomizeSheet';
import type { ScreenBlockId } from '../../utils/screenBlocks';

afterEach(cleanup);

const PROFILE_ORDER: ScreenBlockId[] = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
];
const PATTERNS_ORDER: ScreenBlockId[] = ['heroes', 'ysq_status'];

function baseBlocks(overrides: Partial<ScreenBlocksApi> = {}): ScreenBlocksApi {
  return {
    hidden: [],
    orderedIds: PROFILE_ORDER,
    toggle: vi.fn(),
    reorder: vi.fn().mockReturnValue(true),
    closeSheet: vi.fn(),
    ...overrides,
  };
}

describe('ScreenCustomizeSheet', () => {
  it('рендерит заголовок и все блоки экрана «Профиль»', () => {
    render(<ScreenCustomizeSheet blocks={baseBlocks()} />);
    expect(screen.getByText('Настроить экран')).toBeTruthy();
    expect(screen.getByText('Мой путь')).toBeTruthy();
    expect(screen.getByText('Серия дней')).toBeTruthy();
    expect(screen.getByText('Календарь активности')).toBeTruthy();
    expect(screen.getByText('Достижения')).toBeTruthy();
    expect(screen.getByText('Паттерны')).toBeTruthy();
  });

  it('клик по видимому блоку вызывает toggle(id)', () => {
    const toggle = vi.fn();
    render(<ScreenCustomizeSheet blocks={baseBlocks({ toggle })} />);
    fireEvent.click(screen.getByText('Серия дней'));
    expect(toggle).toHaveBeenCalledWith('streak');
  });

  it('скрытый блок показан как выключенный тумблер (aria-checked=false)', () => {
    render(
      <ScreenCustomizeSheet blocks={baseBlocks({ hidden: ['streak'] })} />,
    );
    const row = screen.getByText('Серия дней').closest('[role="switch"]');
    expect(row?.getAttribute('aria-checked')).toBe('false');
  });

  it('highlight подсвечивает нужную строку и не трогает остальные', () => {
    render(
      <ScreenCustomizeSheet blocks={baseBlocks({ highlight: 'heatmap' })} />,
    );
    const highlighted = screen
      .getByText('Календарь активности')
      .closest('[role="switch"]') as HTMLElement;
    const other = screen
      .getByText('Серия дней')
      .closest('[role="switch"]') as HTMLElement;
    expect(highlighted.style.background).not.toBe('');
    expect(other.style.background).toBe('');
  });

  it('«Готово» вызывает closeSheet', () => {
    const closeSheet = vi.fn();
    render(<ScreenCustomizeSheet blocks={baseBlocks({ closeSheet })} />);
    fireEvent.click(screen.getByText('Готово'));
    expect(closeSheet).toHaveBeenCalled();
  });

  it('рендерит заголовок и оба блока экрана «Паттерны»', () => {
    render(
      <ScreenCustomizeSheet
        blocks={baseBlocks({ orderedIds: PATTERNS_ORDER })}
      />,
    );
    expect(screen.getByText('Настроить экран')).toBeTruthy();
    expect(screen.getByText('Подсказка сверху')).toBeTruthy();
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(2);
  });

  it('клик по строке «Паттернов» вызывает toggle с правильным id', () => {
    const toggle = vi.fn();
    render(
      <ScreenCustomizeSheet
        blocks={baseBlocks({ orderedIds: PATTERNS_ORDER, toggle })}
      />,
    );
    fireEvent.click(screen.getByText('Тест на схемы'));
    expect(toggle).toHaveBeenCalledWith('ysq_status');
  });

  it('строки рендерятся в порядке orderedIds, не в порядке реестра', () => {
    const reordered: ScreenBlockId[] = [
      'streak',
      'journey',
      'heatmap',
      'achievements',
      'insights',
    ];
    render(
      <ScreenCustomizeSheet blocks={baseBlocks({ orderedIds: reordered })} />,
    );
    const labels = screen.getAllByRole('switch').map((row) => row.textContent);
    expect(labels[0]).toContain('Серия дней');
    expect(labels[1]).toContain('Мой путь');
  });

  it('ArrowDown на ручке первой строки вызывает reorder(id, 1)', () => {
    const reorder = vi.fn().mockReturnValue(true);
    render(<ScreenCustomizeSheet blocks={baseBlocks({ reorder })} />);
    const handle = screen.getByLabelText('Переставить: Мой путь');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(reorder).toHaveBeenCalledWith('journey', 1);
  });

  it('ArrowUp на ручке первой строки (край списка) — reorder не вызывается', () => {
    const reorder = vi.fn().mockReturnValue(true);
    render(<ScreenCustomizeSheet blocks={baseBlocks({ reorder })} />);
    const handle = screen.getByLabelText('Переставить: Мой путь');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('ArrowDown на ручке последней строки (край списка) — reorder не вызывается', () => {
    const reorder = vi.fn().mockReturnValue(true);
    render(<ScreenCustomizeSheet blocks={baseBlocks({ reorder })} />);
    const handle = screen.getByLabelText('Переставить: Паттерны');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('клавиша на ручке не переключает тумблер строки', () => {
    const toggle = vi.fn();
    const reorder = vi.fn().mockReturnValue(true);
    render(<ScreenCustomizeSheet blocks={baseBlocks({ toggle, reorder })} />);
    const handle = screen.getByLabelText('Переставить: Мой путь');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('касание/жест ручки (pointerdown→move→up) не переключает тумблер строки', () => {
    const toggle = vi.fn();
    render(<ScreenCustomizeSheet blocks={baseBlocks({ toggle })} />);
    const handle = screen.getByLabelText('Переставить: Мой путь');
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 1 });
    expect(toggle).not.toHaveBeenCalled();
  });
});
