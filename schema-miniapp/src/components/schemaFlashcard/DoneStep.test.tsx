// @vitest-environment jsdom
// DoneStep — итоговый экран флэшкарты после сохранения. Проверяет обе формы
// обращения (правило ты/вы), read-after-write отображение сохранённых
// режима/потребности/шага и опциональную кнопку «Открыть трекер»
// (появляется только когда передан onOpenTracker).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { DoneStep } from './DoneStep';
import type { ModeData } from './types';

afterEach(() => {
  cleanup();
});

const MODES: ModeData[] = [
  {
    id: 'critic',
    emoji: '🪓',
    label: 'Внутренний Критик',
    desc: 'Стыд',
    response: '...',
    color: '#fb923c',
  },
];

const trTy = (ty: string) => ty;
const trVy = (_ty: string, vy: string) => vy;

describe('DoneStep — обращение ты/вы', () => {
  it('форма «ты»', () => {
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed={null}
        action=""
        tr={trTy}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(
      screen.getByText('Это твой шаг навстречу себе. Уже немало.'),
    ).toBeTruthy();
  });

  it('форма «вы» — согласованное множественное число', () => {
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed={null}
        action=""
        tr={trVy}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(
      screen.getByText('Это ваш шаг навстречу себе. Уже немало.'),
    ).toBeTruthy();
  });
});

describe('DoneStep — read-after-write', () => {
  it('показывает сохранённые режим, потребность и шаг', () => {
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed="attachment"
        action="Позвонить другу"
        tr={trTy}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(screen.getByText(/Внутренний Критик/)).toBeTruthy();
    expect(screen.getByText(/Привязанность/)).toBeTruthy();
    expect(screen.getByText('Позвонить другу')).toBeTruthy();
  });

  it('без onOpenTracker кнопка трекера не показывается', () => {
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed={null}
        action=""
        tr={trTy}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(screen.queryByText('Открыть трекер →')).toBeNull();
  });

  it('с onOpenTracker клик закрывает лист и открывает трекер', () => {
    vi.useFakeTimers();
    const onOpenTracker = vi.fn();
    const onClose = vi.fn();
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed={null}
        action=""
        tr={trTy}
        onClose={onClose}
        onOpenTracker={onOpenTracker}
        onNew={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Открыть трекер →'));
    expect(onClose).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(onOpenTracker).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('«Ещё одну» вызывает onNew', () => {
    const onNew = vi.fn();
    render(
      <DoneStep
        modes={MODES}
        selectedMode="critic"
        selectedNeed={null}
        action=""
        tr={trTy}
        onClose={() => {}}
        onNew={onNew}
      />,
    );
    fireEvent.click(screen.getByText('Ещё одну'));
    expect(onNew).toHaveBeenCalled();
  });
});
