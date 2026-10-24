// @vitest-environment jsdom
// Точка входа на «Сегодня»: у новичка на экране обязано быть одно очевидное
// главное действие. Тест закрепляет и обещание «писать почти ничего не надо»
// (снимает главный барьер начала), и равноправность кнопки «Ровный день» —
// спокойные дни должны считаться, иначе продукт учит выискивать плохое.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CaseEntryCard } from './CaseEntryCard';

vi.mock('../../haptic', () => ({
  haptic: { tap: vi.fn(), select: vi.fn() },
}));

afterEach(cleanup);

function renderCard(caseCount: number) {
  const props = {
    caseCount,
    onStart: vi.fn(),
    onSteadyDay: vi.fn(),
    onOpenMap: vi.fn(),
  };
  render(<CaseEntryCard {...props} />);
  return props;
}

describe('CaseEntryCard', () => {
  it('у новичка одно главное действие и честная оценка времени', () => {
    renderCard(0);
    expect(screen.getByText(/Разобрать · ≈ 3 мин/)).toBeTruthy();
    expect(screen.getByText(/писать почти ничего не надо/)).toBeTruthy();
  });

  it('новичку не показывает карту — на ней ещё нечего смотреть', () => {
    renderCard(0);
    expect(screen.queryByText(/Карта себя/)).toBeNull();
  });

  it('«Ровный день» — полноценная кнопка, а не мелкая отговорка', () => {
    const props = renderCard(0);
    const steady = screen.getByRole('button', { name: 'Ровный день' });
    fireEvent.click(steady);
    expect(props.onSteadyDay).toHaveBeenCalledTimes(1);
  });

  it('после разборов зовёт разобрать новый случай и ведёт на карту', () => {
    const props = renderCard(3);
    expect(screen.getByText(/Что сегодня зацепило\?/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Карта себя · 3 разбора/));
    expect(props.onOpenMap).toHaveBeenCalledTimes(1);
  });

  it('счётчик разборов склоняется', () => {
    renderCard(1);
    expect(screen.getByText(/1 разбор →/)).toBeTruthy();
    cleanup();
    renderCard(5);
    expect(screen.getByText(/5 разборов →/)).toBeTruthy();
  });

  it('запуск разбора отдаётся наверх', () => {
    const props = renderCard(0);
    fireEvent.click(screen.getByText(/Разобрать/));
    expect(props.onStart).toHaveBeenCalledTimes(1);
  });
});
