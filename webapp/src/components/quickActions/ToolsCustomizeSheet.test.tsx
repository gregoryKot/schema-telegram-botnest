// @vitest-environment jsdom
// Лист «Какие инструменты показывать» на сайте: те же ключи и события, что у
// мини-аппа (surface 'tools'), перестановка карточек с клавиатуры, у разделов
// страницы ручек нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolsCustomizeSheet } from './ToolsCustomizeSheet';
import { CARD_TOOL_IDS } from '../../sections/practice/toolsLayout';
import { useToolsState } from '../../../../shared/src/quickActions/useToolsState';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const track = api.trackEvent as unknown as ReturnType<typeof vi.fn>;
const changed = vi.fn();

function Host() {
  const tools = useToolsState({ tasksCount: 3, practiceCount: 4, planCount: 0, childhoodDone: true }, changed, CARD_TOOL_IDS);
  return (
    <>
      <output data-testid="cards">{tools.groups[0].map((r) => r.id).join(',')}</output>
      <ToolsCustomizeSheet tools={tools} onClose={vi.fn()} />
    </>
  );
}

beforeEach(() => { localStorage.clear(); track.mockClear(); changed.mockClear(); });
afterEach(cleanup);

const setup = () => render(<MemoryRouter><Host /></MemoryRouter>);

describe('ToolsCustomizeSheet', () => {
  it('две группы: шесть карточек и четыре раздела, подписи с живыми счётчиками', () => {
    setup();
    expect(screen.getAllByRole('switch')).toHaveLength(10);
    expect(screen.getByText('Карточки в «Инструментах»')).toBeTruthy();
    expect(screen.getByText('Разделы страницы')).toBeTruthy();
    expect(screen.getByText('3 цели')).toBeTruthy();
    expect(screen.getByText('4 практики')).toBeTruthy();
    expect(screen.getByText('История пуста')).toBeTruthy();
  });

  it('ручка «≡» у шести карточек, у разделов нет', () => {
    setup();
    expect(document.querySelectorAll('.cz-handle')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Переставить: Мои цели' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Переставить: Схема включилась' })).toBeNull();
  });

  it('перестановка с клавиатуры: порядок в ключ, quick_action_move с surface tools, notifyPrefsChanged', () => {
    setup();
    const before = screen.getByTestId('cards').textContent!.split(',');
    const last = before[before.length - 1];
    const label = screen.getAllByRole('button', { name: /^Переставить: / }).pop()!;
    fireEvent.keyDown(label, { key: 'ArrowUp' });
    const after = screen.getByTestId('cards').textContent!.split(',');
    expect(after[after.length - 2]).toBe(last);
    expect(JSON.parse(localStorage.getItem('quick_actions_order_tools')!)).toContain(last);
    expect(track).toHaveBeenCalledWith('quick_action_move', { action: last, surface: 'tools', dir: 'up' });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('тумблер раздела («Мои цели») скрывает его: ключ, событие, notifyPrefsChanged', () => {
    setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Мои цели' }));
    expect(JSON.parse(localStorage.getItem('quick_actions_hidden_tools')!)).toEqual(['tasks']);
    expect(track).toHaveBeenCalledWith('quick_action_toggle', { action: 'tasks', hidden: true, surface: 'tools' });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('switch', { name: 'Мои цели' }).getAttribute('aria-checked')).toBe('false');
  });
});
