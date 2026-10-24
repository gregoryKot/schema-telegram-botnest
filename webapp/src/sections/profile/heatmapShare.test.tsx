// @vitest-environment jsdom
// MonthShareButton (webapp) — карточка «Мой месяц» из хитмапа профиля,
// паритет с schema-miniapp/src/sections/profile/heatmapShare.tsx (правило
// №16). Ветка «активных дней нет» — кнопки нет вовсе.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MonthShareButton } from './heatmapShare';

afterEach(cleanup);

function renderButton(activeDates: Set<string>, totalDays: number) {
  return render(
    <MemoryRouter>
      <MonthShareButton activeDates={activeDates} totalDays={totalDays} />
    </MemoryRouter>,
  );
}

describe('MonthShareButton (webapp) — нет активных дней', () => {
  it('кнопка не рендерится вовсе', () => {
    const { container } = renderButton(new Set(), 0);
    expect(container.firstChild).toBeNull();
  });
});

describe('MonthShareButton (webapp) — есть активные дни', () => {
  it('клик по кнопке открывает шит «Мой месяц» с картинкой', () => {
    const today = new Date().toISOString().slice(0, 10);
    renderButton(new Set([today]), 5);
    fireEvent.click(screen.getByLabelText('Поделиться месяцем'));
    expect(screen.getAllByText('Мой месяц').length).toBeGreaterThan(0);
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });

  it('клик по фону шита закрывает карточку обратно', () => {
    const today = new Date().toISOString().slice(0, 10);
    renderButton(new Set([today]), 5);
    fireEvent.click(screen.getByLabelText('Поделиться месяцем'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('presentation')[0]);
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
  });
});
