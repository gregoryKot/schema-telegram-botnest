// @vitest-environment jsdom
// QuickActionOverlays — маршрутизация id → оверлей. Реальные компоненты
// (BeliefCheck и т.п.) замоканы — здесь проверяется только диспетчеризация,
// не их внутренняя логика (та уже под своими тестами).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickActionOverlays } from './QuickActionOverlays';

vi.mock('../QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({ id, onClose }: { id: string; onClose: () => void }) => (
    <div>
      <span>QuickPracticeSheet:{id}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock('../BeliefCheck', () => ({
  BeliefCheck: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>BeliefCheck</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock('../PhraseCheck', () => ({
  PhraseCheck: () => <div>PhraseCheck</div>,
}));
vi.mock('../SafePlace', () => ({ SafePlace: () => <div>SafePlace</div> }));
vi.mock('../LetterToSelf', () => ({
  LetterToSelf: () => <div>LetterToSelf</div>,
}));
vi.mock('../SchemaFlashcard', () => ({
  SchemaFlashcard: ({ onOpenTracker }: { onOpenTracker: () => void }) => (
    <div>
      <span>SchemaFlashcard</span>
      <button onClick={onOpenTracker}>open-tracker</button>
    </div>
  ),
}));
vi.mock('../WarmWords', () => ({ WarmWords: () => <div>WarmWords</div> }));

afterEach(cleanup);

describe('QuickActionOverlays — маршрутизация', () => {
  it('active=null — ничего не рендерит', () => {
    const { container } = render(
      <QuickActionOverlays active={null} onClose={vi.fn()} onOpenTracker={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('breathing/grounding/stop → QuickPracticeSheet с нужным id', () => {
    render(
      <QuickActionOverlays
        active="grounding"
        onClose={vi.fn()}
        onOpenTracker={vi.fn()}
      />,
    );
    expect(screen.getByText('QuickPracticeSheet:grounding')).toBeTruthy();
  });

  it('belief_check → BeliefCheck, onClose прокидывается', () => {
    const onClose = vi.fn();
    render(
      <QuickActionOverlays
        active="belief_check"
        onClose={onClose}
        onOpenTracker={vi.fn()}
      />,
    );
    expect(screen.getByText('BeliefCheck')).toBeTruthy();
    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('flashcard → SchemaFlashcard, onOpenTracker прокидывается', () => {
    const onOpenTracker = vi.fn();
    render(
      <QuickActionOverlays
        active="flashcard"
        onClose={vi.fn()}
        onOpenTracker={onOpenTracker}
      />,
    );
    fireEvent.click(screen.getByText('open-tracker'));
    expect(onOpenTracker).toHaveBeenCalled();
  });

  it('warm_words → WarmWords', () => {
    render(
      <QuickActionOverlays
        active="warm_words"
        onClose={vi.fn()}
        onOpenTracker={vi.fn()}
      />,
    );
    expect(screen.getByText('WarmWords')).toBeTruthy();
  });
});
