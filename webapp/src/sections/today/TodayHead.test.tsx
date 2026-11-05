// @vitest-environment jsdom
// Шапка «Сегодня» (#925): дата и «Зачем это?» в одной строке, ниже приветствие
// с именем; без имени — просто «Привет». «Зачем это?» открывает объяснение.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodayHead } from './TodayHead';
import { formatGreetingDate } from './greetingDate';

afterEach(cleanup);

describe('TodayHead', () => {
  it('показывает дату и приветствие с именем', () => {
    render(<TodayHead firstName="Григорий" onWhy={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет, Григорий');
    expect(screen.getByText(formatGreetingDate())).toBeTruthy();
  });

  it('без имени — «Привет» без запятой', () => {
    render(<TodayHead firstName="" onWhy={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет');
  });

  it('«Зачем это?» зовёт onWhy', () => {
    const onWhy = vi.fn();
    render(<TodayHead firstName="Григорий" onWhy={onWhy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Зачем это?' }));
    expect(onWhy).toHaveBeenCalledTimes(1);
  });
});
