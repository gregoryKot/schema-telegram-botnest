// @vitest-environment jsdom
// MonthShareButton — кнопка «Поделиться» на профиле, открывает карточку
// «Мой месяц» (последние 4 недели). 50% покрытия: ветка «активных дней нет»
// (кнопка не рендерится), и сам draw-коллбек (готовит диапазон дат и рисует
// карточку) не были покрыты.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MonthShareButton } from './heatmapShare';

afterEach(cleanup);

describe('MonthShareButton — нет активных дней', () => {
  it('кнопка «Поделиться» не рендерится вовсе', () => {
    render(<MonthShareButton activeDates={new Set()} totalDays={0} />);
    expect(screen.queryByLabelText('Поделиться')).toBeNull();
  });
});

describe('MonthShareButton — есть активные дни', () => {
  it('клик по кнопке открывает шит «Мой месяц» с картинкой', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(<MonthShareButton activeDates={new Set([today])} totalDays={5} />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByText('Мой месяц')).toBeTruthy();
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });

  it('«Закрыть» в шите скрывает карточку обратно', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(<MonthShareButton activeDates={new Set([today])} totalDays={5} />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByText('Мой месяц')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.queryByText('Мой месяц')).toBeNull();
  });
});
