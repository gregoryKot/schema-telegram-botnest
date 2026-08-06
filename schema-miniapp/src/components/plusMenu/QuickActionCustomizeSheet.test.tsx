// @vitest-environment jsdom
// QuickActionCustomizeSheet — generic лист «что показывать» (переиспользует
// ToggleRow, НЕ проверяем его внутреннюю разметку — только текст строки и
// колбэки). Проверяем: toggle шлёт quick_action_toggle с нужным surface,
// повторный toggle возвращает пункт (hidden: false), «Готово» закрывает.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const actions = [
  { id: 'tracker', emoji: '📊', label: 'Трекер потребностей', sub: 'sub-1' },
  { id: 'warm_words', emoji: '💛', label: 'Тёплые слова', sub: 'sub-2' },
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
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalled();
  });
});
