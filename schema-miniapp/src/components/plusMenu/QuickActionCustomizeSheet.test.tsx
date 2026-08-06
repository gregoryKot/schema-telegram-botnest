// @vitest-environment jsdom
// QuickActionCustomizeSheet — generic лист «что показывать» (переиспользует
// CustomizeRow = ToggleRow + MoveArrows, не проверяем их внутреннюю разметку
// — только текст строки и колбэки). Проверяем: toggle шлёт
// quick_action_toggle, «Готово» закрывает, стрелки двигают порядок и шлют
// quick_action_move только при успехе, край задизейблен и не кликается,
// клик по стрелке не переключает тумблер.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const actions = [
  {
    id: 'tracker',
    emoji: '📊',
    label: 'Трекер потребностей',
    sub: 'sub-1',
    disabledUp: true,
    disabledDown: false,
  },
  {
    id: 'warm_words',
    emoji: '💛',
    label: 'Тёплые слова',
    sub: 'sub-2',
    disabledUp: false,
    disabledDown: true,
  },
];

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('QuickActionCustomizeSheet', () => {
  it('рендерит заголовок и все переданные действия', () => {
    render(
      <QuickActionCustomizeSheet
        title="Что показывать в «плюсе»"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onMove={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Что показывать в «плюсе»')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
    expect(screen.getByText('Тёплые слова')).toBeTruthy();
  });

  it('клик по видимому пункту скрывает его: quick_action_toggle(hidden:true, surface)', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={onToggle}
        onMove={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Тёплые слова'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: true,
      surface: 'plus',
    });
    expect(onToggle).toHaveBeenCalledWith('warm_words', true);
  });

  it('клик по скрытому пункту возвращает его: hidden:false, surface=tools', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="tools"
        actions={actions}
        hidden={['warm_words']}
        onToggle={onToggle}
        onMove={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Тёплые слова'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: false,
      surface: 'tools',
    });
    expect(onToggle).toHaveBeenCalledWith('warm_words', false);
  });

  it('«Готово» закрывает лист', () => {
    const onClose = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onMove={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalled();
  });

  it('стрелка двигает: onMove(id, dir) вызван, при успехе шлёт quick_action_move', () => {
    const onMove = vi.fn().mockReturnValue(true);
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );
    // У «Трекера» (первая строка) вверх задизейблен, вниз — нет.
    fireEvent.click(screen.getAllByLabelText('Ниже')[0]);
    expect(onMove).toHaveBeenCalledWith('tracker', 'down');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'plus',
      dir: 'down',
    });
  });

  it('onMove вернул false (внутренний край) — quick_action_move не отправлен', () => {
    const onMove = vi.fn().mockReturnValue(false);
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="tools"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Ниже')[0]);
    expect(onMove).toHaveBeenCalledWith('tracker', 'down');
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'quick_action_move',
      expect.anything(),
    );
  });

  it('задизейбленная стрелка на краю: aria-disabled, клик не вызывает onMove и не шлёт событие', () => {
    const onMove = vi.fn().mockReturnValue(true);
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );
    // «Трекер» — первая строка, стрелка вверх задизейблена.
    const upTracker = screen.getAllByLabelText('Выше')[0];
    expect(upTracker.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(upTracker);
    expect(onMove).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'quick_action_move',
      expect.anything(),
    );
  });

  it('клик по стрелке не переключает тумблер строки', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={onToggle}
        onMove={vi.fn().mockReturnValue(true)}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Ниже')[0]);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
