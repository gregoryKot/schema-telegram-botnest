// @vitest-environment jsdom
// docs/open/frontend-ux.md: свайп трекера слушал весь оверлей, и палец,
// проехавший по шкале оценки ≥90px, уводил на другую потребность. Общий хук
// (shared/src/hooks/useHorizontalSwipe.ts) не начинает свайп внутри
// [role="group"] — здесь проверяем, что шкала мини-аппа под это попадает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useHorizontalSwipe } from '../../../shared/src/hooks/useHorizontalSwipe';
import { NeedRatingBar } from './NeedRatingBar';

afterEach(cleanup);

function Harness({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const swipe = useHorizontalSwipe(onNext, onPrev, false);
  return (
    <div {...swipe}>
      <p>Фон вопроса</p>
      <NeedRatingBar
        color="var(--accent-blue)"
        value={undefined}
        onChange={() => {}}
      />
    </div>
  );
}

function drag(el: Element, fromX: number, toX: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: fromX, clientY: 300 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: toX, clientY: 305 }] });
}

describe('useHorizontalSwipe + NeedRatingBar', () => {
  it('жест по шкале оценки не листает потребность', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);
    const seg = screen.getByLabelText('Поставить 5');
    drag(seg, 300, 100);
    drag(seg, 100, 300);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('контроль: жест по фону листает — влево вперёд, вправо назад', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);
    drag(screen.getByText('Фон вопроса'), 300, 100);
    drag(screen.getByText('Фон вопроса'), 100, 300);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
