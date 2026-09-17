// @vitest-environment jsdom
// ActionButtons — четыре перехода в кабинете терапевта (задания/заметки/
// концептуализация/записи клиента). Проверяет счётчики-подсказки: они
// реальные (посчитаны из detail), а не показываются на пустых списках —
// пустой список активных заданий не должен рисовать «0 активных».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ActionButtons } from './ActionButtons';
import type { ClientDetail } from './types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    clientTasks: [],
    notes: [],
    concept: null,
    clientSchemaNotesData: [],
    clientModeNotesData: [],
    setShowTasksSheet: vi.fn(),
    setShowNotesSheet: vi.fn(),
    setShowConceptSheet: vi.fn(),
    setShowClientNotesSheet: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

describe('ActionButtons — счётчики-подсказки', () => {
  it('нет активных заданий — подсказка «N активных» не рисуется', () => {
    render(<ActionButtons detail={makeDetail({ clientTasks: [] })} />);
    expect(screen.queryByText(/активных/)).toBeNull();
  });

  it('есть невыполненные задания — считает только их (не выполненные сегодня)', () => {
    const clientTasks = [
      { done: null, doneToday: false },
      { done: null, doneToday: true }, // выполнено сегодня — не «активное»
      { done: true, doneToday: false }, // уже завершено
    ] as unknown as ClientDetail['clientTasks'];
    render(<ActionButtons detail={makeDetail({ clientTasks })} />);
    expect(screen.getByText('1 активных')).toBeTruthy();
  });

  it('без заметок сессий подсказка не рисуется', () => {
    render(<ActionButtons detail={makeDetail({ notes: [] })} />);
    expect(screen.queryByText(/заметок/)).toBeNull();
  });

  it('без концептуализации нет строки «Обновлено»', () => {
    render(<ActionButtons detail={makeDetail({ concept: null })} />);
    expect(screen.queryByText(/Обновлено/)).toBeNull();
  });

  it('без записей клиента — нейтральная подпись, а не «0 · 0»', () => {
    render(
      <ActionButtons
        detail={makeDetail({
          clientSchemaNotesData: [],
          clientModeNotesData: [],
        })}
      />,
    );
    expect(screen.getByText('Карточки схем и режимов')).toBeTruthy();
  });

  it('с записями клиента — реальные числа схем и режимов', () => {
    render(
      <ActionButtons
        detail={makeDetail({
          clientSchemaNotesData: [
            {},
            {},
          ] as unknown as ClientDetail['clientSchemaNotesData'],
          clientModeNotesData: [
            {},
          ] as unknown as ClientDetail['clientModeNotesData'],
        })}
      />,
    );
    expect(screen.getByText(/Схем: 2 · Режимов: 1/)).toBeTruthy();
  });
});

describe('ActionButtons — переходы', () => {
  it('клик по «Задания» открывает лист заданий', () => {
    const setShowTasksSheet = vi.fn();
    render(<ActionButtons detail={makeDetail({ setShowTasksSheet })} />);
    fireEvent.click(screen.getByText('Задания'));
    expect(setShowTasksSheet).toHaveBeenCalledWith(true);
  });

  it('клик по «Концептуализация» открывает свой лист, а не заметки', () => {
    const setShowConceptSheet = vi.fn();
    const setShowNotesSheet = vi.fn();
    render(
      <ActionButtons
        detail={makeDetail({ setShowConceptSheet, setShowNotesSheet })}
      />,
    );
    fireEvent.click(screen.getByText('Концептуализация'));
    expect(setShowConceptSheet).toHaveBeenCalledWith(true);
    expect(setShowNotesSheet).not.toHaveBeenCalled();
  });
});
