// @vitest-environment jsdom
// Библиотека упражнений — бенто плиток бумаги (b14): у каждой плитки бумага и знак своей
// сущности (exerciseLook), без номеров 01–08. Подпись «не начато» помечена классом is-new, чтобы
// телефонная раскладка прятала её и показывала статистику, только когда она есть (реальные
// данные, не выдуманные).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { EXERCISES } from './exerciseLibraryModel';
import { exerciseLook } from './practiceLook';

afterEach(cleanup);

describe('ExerciseLibrary', () => {
  it('8 плиток-кнопок на бумаге своей сущности, у каждой знак; без номеров и tone-tint', () => {
    const { container } = render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>('button.cp-ex.pp-paper'));
    expect(cards).toHaveLength(8);
    expect(container.querySelector('.tone-tint, .ds-card, .cp-ex-num')).toBeNull();
    cards.forEach((c, i) => {
      expect(c.style.getPropertyValue('--h')).toBe(String(exerciseLook(EXERCISES[i].id).hue));
      expect(c.querySelector('.cp-ex-art svg')).not.toBeNull();
    });
  });

  it('клик по плитке открывает своё упражнение', () => {
    const onOpen = vi.fn();
    render(<ExerciseLibrary stats={{}} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Безопасное место').closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('safe');
  });

  it('без статистики все карточки «не начато» с is-new', () => {
    render(<ExerciseLibrary stats={{}} onOpen={vi.fn()} />);
    const states = screen.getAllByText('не начато');
    expect(states).toHaveLength(8);
    expect(states.every(el => el.classList.contains('is-new'))).toBe(true);
  });

  it('упражнение со статистикой показывает счётчик без is-new', () => {
    render(<ExerciseLibrary stats={{ safe: { count: 3, lastDone: null } }} onOpen={vi.fn()} />);
    const el = screen.getByText(/3 записи/).closest('.cp-ex-state')!;
    expect(el.classList.contains('is-new')).toBe(false);
    expect(screen.getAllByText('не начато')).toHaveLength(7);
  });

  // Колесо детства — единственное упражнение без даты прохождения
  // (`lastDone: null`): API отдаёт только оценки. «пройдено» — ветка на месте
  // вызова, shared-fmtAgo принимает только момент; без ветки new Date(null) —
  // эпоха, и карточка молча врала бы «1 янв.».
  it('колесо детства без даты прохождения — подпись «пройдено», а не «1 янв.»', () => {
    render(<ExerciseLibrary stats={{ wheel: { count: 1, lastDone: null } }} onOpen={vi.fn()} />);
    const el = screen.getByText(/1 запись/).closest('.cp-ex-state')!;
    expect(el.textContent).toBe('1 запись\u00a0· пройдено');
    expect(el.textContent).not.toContain('янв');
  });

  it('с датой прохождения — давность из fmtAgo', () => {
    render(<ExerciseLibrary stats={{ letter: { count: 2, lastDone: new Date().toISOString() } }} onOpen={vi.fn()} />);
    expect(screen.getByText(/2 записи/).closest('.cp-ex-state')!.textContent).toBe('2 записи\u00a0· сегодня');
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
