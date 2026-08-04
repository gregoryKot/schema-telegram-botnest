// @vitest-environment jsdom
// HistoryControls — переключатели «День/Неделя» и глубина истории.
// Без onChangeDays блок глубины истории вообще не рендерится (опциональный
// проп — сценарий, где выбор недели скрыт).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryControls } from './HistoryControls';

afterEach(() => {
  cleanup();
});

describe('HistoryControls — переключатель День/Неделя', () => {
  it('клик по «Неделя» вызывает onSubView с "week"', () => {
    const onSubView = vi.fn();
    render(<HistoryControls subView="day" onSubView={onSubView} days={7} />);
    fireEvent.click(screen.getByText('Неделя'));
    expect(onSubView).toHaveBeenCalledWith('week');
  });

  it('клик по «День» вызывает onSubView с "day"', () => {
    const onSubView = vi.fn();
    render(<HistoryControls subView="week" onSubView={onSubView} days={7} />);
    fireEvent.click(screen.getByText('День'));
    expect(onSubView).toHaveBeenCalledWith('day');
  });
});

describe('HistoryControls — глубина истории', () => {
  it('без onChangeDays блок глубины не отображается', () => {
    render(<HistoryControls subView="day" onSubView={() => {}} days={7} />);
    expect(screen.queryByText('7д')).toBeNull();
  });

  it('с onChangeDays показывает варианты 7/14/30 дней, клик передаёт значение', () => {
    const onChangeDays = vi.fn();
    render(
      <HistoryControls
        subView="day"
        onSubView={() => {}}
        days={7}
        onChangeDays={onChangeDays}
      />,
    );
    expect(screen.getByText('7д')).toBeTruthy();
    expect(screen.getByText('14д')).toBeTruthy();
    expect(screen.getByText('30д')).toBeTruthy();
    fireEvent.click(screen.getByText('30д'));
    expect(onChangeDays).toHaveBeenCalledWith(30);
  });
});
