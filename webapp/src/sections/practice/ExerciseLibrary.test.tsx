// @vitest-environment jsdom
// Библиотека упражнений: подпись «не начато» помечена классом is-new, чтобы
// телефонная раскладка прятала её и показывала статистику, только когда она
// есть (реальные данные, не выдуманные).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { EXERCISES } from './exerciseLibrary';

afterEach(cleanup);

describe('ExerciseLibrary', () => {
  it('без статистики все карточки «не начато» с is-new', () => {
    render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} />);
    const states = screen.getAllByText('не начато');
    expect(states).toHaveLength(8);
    expect(states.every(el => el.classList.contains('is-new'))).toBe(true);
  });

  it('упражнение со статистикой показывает счётчик без is-new', () => {
    render(<ExerciseLibrary stats={{ safe: { count: 3, lastDone: null } }} onOpen={vi.fn()} />);
    const el = screen.getByText(/3 записи/);
    expect(el.classList.contains('is-new')).toBe(false);
    expect(screen.getAllByText('не начато')).toHaveLength(7);
  });

  it('заголовок: «Библиотека» на десктопе, «Инструменты» на телефоне', () => {
    const { rerender } = render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Библиотека' })).toBeTruthy();
    rerender(<ExerciseLibrary phone stats={{}} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Инструменты' })).toBeTruthy();
  });
});

describe('ExerciseLibrary — настроенный список', () => {
  it('рисует переданные карточки и считает их, а не все восемь', () => {
    render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} items={EXERCISES.slice(0, 2)} />);
    expect(screen.getAllByText('не начато')).toHaveLength(2);
    expect(screen.getByText('2 упражнения')).toBeTruthy();
  });

  it('пустой список — раздел не рисуется (ни заголовка, ни счётчика)', () => {
    const { container } = render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} items={[]} />);
    expect(container.textContent).toBe('');
  });
});
