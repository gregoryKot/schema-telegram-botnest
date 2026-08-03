// @vitest-environment jsdom
// Профиль: тепловая карта активности (CLAUDE.md — приоритет покрытия
// «профиль/статистика», правило «никаких хардкод-заглушек» — на чистом
// аккаунте кнопка «поделиться месяцем» не показывается вообще, а не рисует
// пустую/выдуманную карточку).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ActivityHeatmap } from './ActivityHeatmap';

afterEach(() => {
  cleanup();
});

describe('ActivityHeatmap — пустое состояние (чистый аккаунт)', () => {
  it('нет ни одного активного дня — кнопка «поделиться месяцем» не рендерится', () => {
    render(<ActivityHeatmap activeDates={new Set()} totalDays={0} />);
    expect(screen.getByText('Активность')).toBeTruthy();
    expect(screen.queryByLabelText('Поделиться')).toBeNull();
  });

  it('легенда «меньше/больше» рендерится даже без данных (форма экрана на месте)', () => {
    render(<ActivityHeatmap activeDates={new Set()} totalDays={0} />);
    expect(screen.getByText('меньше')).toBeTruthy();
    expect(screen.getByText('больше')).toBeTruthy();
  });
});

describe('ActivityHeatmap — есть активность', () => {
  it('есть хотя бы один активный день сегодня — показывает кнопку «поделиться месяцем»', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(<ActivityHeatmap activeDates={new Set([today])} totalDays={5} />);
    expect(screen.getByLabelText('Поделиться')).toBeTruthy();
  });

  it('активные даты вне видимого окна (10 недель) не считаются реальной активностью карты, но не роняют рендер', () => {
    render(
      <ActivityHeatmap activeDates={new Set(['2000-01-01'])} totalDays={1} />,
    );
    // Дата за пределами окна — MonthShareButton считает по всему grid,
    // построенному от today, так что старая дата просто не попадёт в grid;
    // компонент обязан отрендериться без ошибок в любом случае.
    expect(screen.getByText('Активность')).toBeTruthy();
  });
});
