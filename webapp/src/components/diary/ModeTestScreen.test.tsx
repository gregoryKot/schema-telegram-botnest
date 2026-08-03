// @vitest-environment jsdom
// ModeTestScreen — двухуровневый тест «какой режим включился» в дневнике
// (0% покрытия). Проверяем оба уровня выбора и что аналитика
// MODE_TEST_COMPLETED_EVENT шлётся только на финальном выборе листа, не на
// промежуточном выборе группы (иначе метрика завышает завершения теста).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeTestScreen } from './ModeTestScreen';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { trackEvent: (...a: unknown[]) => trackEvent(...a) },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ModeTestScreen — уровень 1 (крупные состояния)', () => {
  it('рендерит все группы верхнего уровня', () => {
    render(<ModeTestScreen onPick={vi.fn()} onBack={vi.fn()} />);
    for (const g of MODE_PICKER_GROUPS) {
      expect(screen.getByText(g.title)).toBeTruthy();
    }
  });

  it('«Назад к выбору» на первом уровне зовёт onBack', () => {
    const onBack = vi.fn();
    render(<ModeTestScreen onPick={vi.fn()} onBack={onBack} />);
    fireEvent.click(screen.getByText('Назад к выбору'));
    expect(onBack).toHaveBeenCalled();
  });

  it('выбор группы переходит на уровень 2, не вызывая onPick и не трекая событие', () => {
    const onPick = vi.fn();
    render(<ModeTestScreen onPick={onPick} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText(MODE_PICKER_GROUPS[0].title));
    expect(onPick).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByText(MODE_PICKER_GROUPS[0].leaves[0].label)).toBeTruthy();
  });
});

describe('ModeTestScreen — уровень 2 (листы группы)', () => {
  it('выбор конкретного режима зовёт onPick с его id и трекает MODE_TEST_COMPLETED_EVENT', () => {
    const onPick = vi.fn();
    render(<ModeTestScreen onPick={onPick} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText(MODE_PICKER_GROUPS[0].title));
    const leaf = MODE_PICKER_GROUPS[0].leaves[0];
    fireEvent.click(screen.getByText(leaf.label));
    expect(onPick).toHaveBeenCalledWith(leaf.modeId);
    expect(trackEvent).toHaveBeenCalledWith('mode_test_completed', { modeId: leaf.modeId });
  });

  it('«К другим состояниям» возвращает на уровень 1', () => {
    render(<ModeTestScreen onPick={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText(MODE_PICKER_GROUPS[0].title));
    fireEvent.click(screen.getByText('К другим состояниям'));
    expect(screen.getByText(MODE_PICKER_GROUPS[0].title)).toBeTruthy();
  });
});
