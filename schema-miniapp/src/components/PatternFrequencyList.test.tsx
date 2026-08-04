// @vitest-environment jsdom
// PatternFrequencyList — сгруппированный список с недельной частотой
// (0% покрытия). Проверяем: сортировку по убыванию частоты внутри группы,
// анти-стыд правило (freq=0 — без полоски/цифры, просто название), клики,
// склонение «день/дня/дней», и что hint показывается только при anyFreq.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PatternFrequencyList, type FreqGroup } from './PatternFrequencyList';

afterEach(cleanup);

const groups: FreqGroup[] = [
  {
    title: 'Отчуждение',
    items: [
      { id: 'a', name: 'Схема А', freq: 2 },
      { id: 'b', name: 'Схема Б', freq: 5 },
      { id: 'c', name: 'Схема В', freq: 0 },
    ],
  },
];

describe('PatternFrequencyList — сортировка и анти-стыд отображение', () => {
  it('внутри группы сортирует по убыванию частоты', () => {
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={() => {}}
        addLabel="Добавить"
        onAdd={() => {}}
        anyFreq
      />,
    );
    const names = screen.getAllByText(/^Схема /).map((el) => el.textContent);
    expect(names).toEqual(['Схема Б', 'Схема А', 'Схема В']);
  });

  it('freq=0 — без цифры-дней, просто название (не квота «/7», не оценка)', () => {
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={() => {}}
        addLabel="Добавить"
        onAdd={() => {}}
        anyFreq
      />,
    );
    expect(screen.queryByText(/0 дней/)).toBeNull();
  });

  it.each([
    [1, '1 день'],
    [2, '2 дня'],
    [5, '5 дней'],
    [11, '11 дней'],
  ])('freq=%i рендерит «%s»', (freq, expected) => {
    render(
      <PatternFrequencyList
        groups={[{ title: 'Г', items: [{ id: 'x', name: 'X', freq }] }]}
        onSelect={() => {}}
        addLabel="Добавить"
        onAdd={() => {}}
        anyFreq
      />,
    );
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('PatternFrequencyList — клики', () => {
  it('клик по элементу зовёт onSelect(id)', () => {
    const onSelect = vi.fn();
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={onSelect}
        addLabel="Добавить"
        onAdd={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Схема А'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('клик по кнопке добавления зовёт onAdd', () => {
    const onAdd = vi.fn();
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={() => {}}
        addLabel="Собрать вручную"
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByText('Собрать вручную'));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('PatternFrequencyList — подсказка (hint)', () => {
  it('anyFreq=false — hint не показывается, даже если передан', () => {
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={() => {}}
        addLabel="Добавить"
        onAdd={() => {}}
        hint="Полоска — не оценка"
        anyFreq={false}
      />,
    );
    expect(screen.queryByText('Полоска — не оценка')).toBeNull();
  });

  it('anyFreq=true и hint задан — показывается', () => {
    render(
      <PatternFrequencyList
        groups={groups}
        onSelect={() => {}}
        addLabel="Добавить"
        onAdd={() => {}}
        hint="Полоска — не оценка"
        anyFreq
      />,
    );
    expect(screen.getByText('Полоска — не оценка')).toBeTruthy();
  });
});
