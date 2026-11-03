// @vitest-environment jsdom
// docs/open/frontend-ux.md: свайп трекера слушает весь оверлей, и палец,
// проехавший по шкале оценки ≥90px, уводил на другую потребность вместо
// выбора ответа. Касание, начатое внутри [role="group"] (шкала WordScale /
// NeedScale), свайпом не считается; по фону — по-прежнему листает.
// Хук общий (shared/src/hooks/useHorizontalSwipe.ts), шкала мини-аппа —
// schema-miniapp/src/components/NeedRatingBar.swipe.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useHorizontalSwipe } from '../../../../shared/src/hooks/useHorizontalSwipe';
import { NeedScale } from '../NeedScale';

afterEach(cleanup);

function Harness({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const swipe = useHorizontalSwipe(onNext, onPrev, false);
  return (
    <div data-testid="overlay" {...swipe}>
      <p>Фон вопроса</p>
      <NeedScale variant="words" value={undefined} hue={200} label="Близость" onChange={() => {}} />
      <NeedScale value={undefined} hue={200} label="Шкала 10" onChange={() => {}} />
    </div>
  );
}

function drag(el: Element, fromX: number, toX: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: fromX, clientY: 300 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: toX, clientY: 305 }] });
}

describe('useHorizontalSwipe + NeedScale — жест по шкале не листает вопрос', () => {
  it('горизонтальный жест, начатый на шкале оценки, не вызывает перелистывание', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);
    for (const name of ['Близость', 'Шкала 10']) {
      const seg = screen.getByRole('group', { name }).querySelector('button')!;
      drag(seg, 300, 100);
      drag(seg, 100, 300);
    }
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('контроль: тот же жест по фону листает — влево вперёд, вправо назад', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);
    const bg = screen.getByText('Фон вопроса');
    drag(bg, 300, 100);
    expect(onNext).toHaveBeenCalledTimes(1);
    drag(bg, 100, 300);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('контроль: короткий жест по фону (<90px) не листает', () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} onPrev={vi.fn()} />);
    drag(screen.getByText('Фон вопроса'), 300, 240);
    expect(onNext).not.toHaveBeenCalled();
  });
});
