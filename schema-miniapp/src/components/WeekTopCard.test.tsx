// @vitest-environment jsdom
// Карточка недельной сводки схем/режимов (CLAUDE.md — приоритет покрытия
// «карточки схем/режимов», правило «одна механика — один компонент» — общая
// карточка для схем и режимов). Поведение: рендерит переданные данные, клик
// вызывает onClick.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WeekTopCard } from './WeekTopCard';

afterEach(() => {
  cleanup();
});

describe('WeekTopCard', () => {
  it('показывает переданные метку, заголовок и подпись', () => {
    render(
      <WeekTopCard
        label="Чаще всего звучит"
        color="#818cf8"
        title="Покинутость"
        sub="Включалась 4 раза за неделю"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Чаще всего звучит')).toBeTruthy();
    expect(screen.getByText('Покинутость')).toBeTruthy();
    expect(screen.getByText('Включалась 4 раза за неделю')).toBeTruthy();
  });

  it('клик по карточке вызывает onClick', () => {
    const onClick = vi.fn();
    render(
      <WeekTopCard
        label="Чаще всего включается"
        color="#f472b6"
        title="Уязвимый Ребёнок"
        sub="3 раза"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
