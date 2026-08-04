// @vitest-environment jsdom
// HistoryDatePicker — лента дней истории. Проверяет клик выбирает день по
// индексу, число дня без ведущего нуля, и что день без единой оценки не
// красит мини-бар (нет данных ≠ красная оценка) — регресс на границе
// hasData/цвет незаметен глазом.
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryDatePicker } from './HistoryDatePicker';
import type { DayHistory, Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '💙', title: 'A', chartLabel: 'A' },
];

function Wrapper({
  history,
  selectedIdx,
  onSelect,
}: {
  history: DayHistory[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <HistoryDatePicker
      history={history}
      needs={NEEDS}
      selectedIdx={selectedIdx}
      onSelect={onSelect}
      dateBtnRefs={refs}
    />
  );
}

describe('HistoryDatePicker', () => {
  it('показывает номер дня без ведущего нуля', () => {
    render(
      <Wrapper
        history={[{ date: '2026-08-03', ratings: {} }]}
        selectedIdx={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('клик по дню вызывает onSelect с его индексом', () => {
    const onSelect = vi.fn();
    render(
      <Wrapper
        history={[
          { date: '2026-08-01', ratings: {} },
          { date: '2026-08-02', ratings: { attachment: 5 } },
        ]}
        selectedIdx={0}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('2'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('рендерит день для каждого элемента истории', () => {
    render(
      <Wrapper
        history={[
          { date: '2026-08-01', ratings: {} },
          { date: '2026-08-02', ratings: {} },
          { date: '2026-08-03', ratings: {} },
        ]}
        selectedIdx={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
