// @vitest-environment jsdom
// NeedStep — шаг выбора потребности во флэшкарте схемы: клик по варианту
// вызывает onSelectNeed(id), кнопка «назад» — onBack(). Тест ловит регресс
// выбора (неверный id ушёл наверх) и потерю кнопки навигации.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedStep } from './NeedStep';
import { NEEDS } from './constants';

afterEach(() => {
  cleanup();
});

describe('NeedStep', () => {
  it('рендерит все варианты потребностей из NEEDS', () => {
    render(
      <NeedStep
        selectedNeed={null}
        stepIndex={2}
        onClose={() => {}}
        onBack={() => {}}
        onSelectNeed={() => {}}
      />,
    );
    for (const n of NEEDS) {
      expect(screen.getByText(n.label)).toBeTruthy();
    }
  });

  it('клик по варианту вызывает onSelectNeed с правильным id', () => {
    const onSelectNeed = vi.fn();
    render(
      <NeedStep
        selectedNeed={null}
        stepIndex={2}
        onClose={() => {}}
        onBack={() => {}}
        onSelectNeed={onSelectNeed}
      />,
    );
    fireEvent.click(screen.getByText(NEEDS[1].label));
    expect(onSelectNeed).toHaveBeenCalledWith(NEEDS[1].id);
  });

  it('кнопка «назад» вызывает onBack', () => {
    const onBack = vi.fn();
    render(
      <NeedStep
        selectedNeed={NEEDS[0].id}
        stepIndex={2}
        onClose={() => {}}
        onBack={onBack}
        onSelectNeed={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('←'));
    expect(onBack).toHaveBeenCalled();
  });
});
