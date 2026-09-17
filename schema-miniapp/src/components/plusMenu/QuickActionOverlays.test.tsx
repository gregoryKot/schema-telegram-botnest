// @vitest-environment jsdom
// QuickActionOverlays — маршрутизация id → оверлей. После сведения дублей
// (2026-08) «плюс» открывает через этот компонент только три экстренные
// практики (breathing/grounding/stop) — belief_check/phrase_check/flashcard/
// safe_place/letter_to_self/warm_words переехали в «Инструменты» и больше не
// входят в OverlayQuickActionId (см. quickActionsRegistry.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickActionOverlays } from './QuickActionOverlays';

vi.mock('../QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({
    id,
    onClose,
  }: {
    id: string;
    onClose: () => void;
  }) => (
    <div>
      <span>QuickPracticeSheet:{id}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

afterEach(cleanup);

describe('QuickActionOverlays — маршрутизация', () => {
  it('active=null — ничего не рендерит', () => {
    const { container } = render(
      <QuickActionOverlays active={null} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('breathing/grounding/stop → QuickPracticeSheet с нужным id', () => {
    render(<QuickActionOverlays active="grounding" onClose={vi.fn()} />);
    expect(screen.getByText('QuickPracticeSheet:grounding')).toBeTruthy();
  });

  // Из «плюса» дыхание открывается пошаговым листом, а не карточкой
  // BreathingCard (та живёт только в блоке «Здесь и сейчас») — ветка легко
  // теряется при правке switch, поэтому проверяется отдельно.
  it('breathing → тот же лист, а не карточка дыхания', () => {
    render(<QuickActionOverlays active="breathing" onClose={vi.fn()} />);
    expect(screen.getByText('QuickPracticeSheet:breathing')).toBeTruthy();
  });

  it('onClose прокидывается в закрытие практики', () => {
    const onClose = vi.fn();
    render(<QuickActionOverlays active="stop" onClose={onClose} />);
    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalled();
  });
});
