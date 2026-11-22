// @vitest-environment jsdom
// Находка аудита 2026-10: сервер отдаёт максимум 100 заметок, а кабинет рисовал
// срез как полный список: счётчик и «Сессия N» считались от среза. Теперь
// счётчик и номера идут от total, а над списком стоит строка о срезе.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionArchive } from './SessionArchive';
import { api } from '../../api';

vi.mock('../../api', () => ({ api: { getTherapistNote: vi.fn(), listCustomModes: vi.fn() }, reportClientError: vi.fn() }));
import type { TherapistNote } from '../../api';
import { paperSignName } from '../../test-support/paperSign';

// Подтверждение пишет запись в историю (HistoryConfirmDialog) — нужен роутер.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(cleanup);

const rows = (n: number): TherapistNote[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    therapistId: '1',
    clientId: '2',
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    text: `заметка ${i + 1}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  })) as unknown as TherapistNote[];

describe('SessionArchive', () => {
  it('срез: счётчик от total, строка о срезе, номера со сдвигом', () => {
    render(<SessionArchive page={{ notes: rows(100), total: 105 }} removeNote={vi.fn()} />);
    expect(screen.getByText('Архив · 105 заметок')).toBeTruthy();
    expect(screen.getByText(/Показаны последние 100 из 105/)).toBeTruthy();
    expect(screen.getByText('Сессия 6')).toBeTruthy();
    expect(screen.getByText('Сессия 105')).toBeTruthy();
    expect(screen.queryByText('Сессия 1')).toBeNull();
  });

  it('показано всё: строки о срезе нет, номера с единицы', () => {
    render(<SessionArchive page={{ notes: rows(3), total: 3 }} removeNote={vi.fn()} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText('Сессия 1')).toBeTruthy();
  });

  it('пустая история: «Заметок пока нет» со знаком заметки (Pebbles — как у формы и «Заметки сессии», r1), без строки о срезе', () => {
    const { container } = render(<SessionArchive page={{ notes: [], total: 0 }} removeNote={vi.fn()} />);
    expect(screen.getByText('Заметок пока нет')).toBeTruthy();
    expect(paperSignName(container.querySelector('.tb-empty-row svg'))).toBe('Pebbles');
    expect(screen.queryByRole('note')).toBeNull();
  });

  // QA 2026-10-26: «Архив · 2 заметок».
  it('счётчик склоняется: 1 заметка, 2 заметки, 5 заметок', () => {
    render(<SessionArchive page={{ notes: rows(2), total: 2 }} removeNote={vi.fn()} />);
    expect(screen.getByText('Архив · 2 заметки')).toBeTruthy();
    cleanup();
    render(<SessionArchive page={{ notes: rows(1), total: 1 }} removeNote={vi.fn()} />);
    expect(screen.getByText('Архив · 1 заметка')).toBeTruthy();
  });

  // QA 2026-10-26: заметка удалялась одним кликом по «✕».
  it('«✕» спрашивает подтверждение; «Отмена» не удаляет, «Удалить» удаляет', async () => {
    const removeNote = vi.fn().mockResolvedValue(undefined);
    render(<SessionArchive page={{ notes: rows(2), total: 2 }} removeNote={removeNote} />);
    fireEvent.click(screen.getAllByLabelText('Удалить заметку')[0]);
    expect(removeNote).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить заметку?')).toBeTruthy();
    fireEvent.click(screen.getByText('Отмена'));
    expect(removeNote).not.toHaveBeenCalled();
    expect(screen.queryByText('Удалить заметку?')).toBeNull();

    fireEvent.click(screen.getAllByLabelText('Удалить заметку')[1]);
    fireEvent.click(screen.getByText('Удалить'));
    await waitFor(() => expect(removeNote).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByText('Удалить заметку?')).toBeNull());
  });

  it('пришли из журнала «На сессиях»: запись прокручена в вид и подсвечена, один раз', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const takeFocus = vi.fn(() => 2);
    const { container } = render(<SessionArchive page={{ notes: rows(3), total: 3 }} removeNote={vi.fn()} takeFocus={takeFocus} />);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.tb-tl-row--focus')?.textContent).toContain('заметка 2');
    expect(takeFocus).toHaveBeenCalledTimes(1);
  });

  describe('запись из журнала за пределами показанных', () => {
    const early = { ...rows(1)[0], id: 900, date: '2025-03-04', text: 'ранняя заметка' };
    const open = (removeNote = vi.fn()) => render(<SessionArchive page={{ notes: rows(100), total: 105 }} removeNote={removeNote} takeFocus={() => 900} clientId={42} />);
    const confirmDelete = async (container: HTMLElement) => {
      await screen.findByText('ранняя заметка');
      fireEvent.click(container.querySelector('.tb-tl-row--focus [aria-label="Удалить заметку"]')!);
      expect(screen.getByText(/^Заметка о сессии 3 от 4 .+ 2025 удалится насовсем\.$/)).toBeTruthy();
      fireEvent.click(screen.getByText('Удалить'));
    };

    it('удаляется тем же подтверждением, что показанная, и уходит с экрана', async () => {
      vi.mocked(api.getTherapistNote).mockResolvedValue({ note: early, number: 3 });
      const removeNote = vi.fn().mockResolvedValue(true);
      const { container } = open(removeNote);
      await confirmDelete(container);
      await waitFor(() => expect(screen.queryByText('ранняя заметка')).toBeNull());
      expect(removeNote).toHaveBeenCalledWith(900);
      await waitFor(() => expect(screen.queryByText('Удалить заметку?')).toBeNull());
      expect(screen.queryByText('Более ранняя запись')).toBeNull();
    });

    it('удаление не прошло — запись остаётся на экране', async () => {
      vi.mocked(api.getTherapistNote).mockResolvedValue({ note: early, number: 3 });
      const removeNote = vi.fn().mockResolvedValue(false);
      const { container } = open(removeNote);
      await confirmDelete(container);
      await waitFor(() => expect(screen.queryByText('Удалить заметку?')).toBeNull());
      expect(screen.getByText('ранняя заметка')).toBeTruthy();
    });

    it('догружается по id и встаёт под архивом со своим номером, подсвечена', async () => {
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      vi.mocked(api.getTherapistNote).mockResolvedValue({ note: early, number: 3 });
      const { container } = open();
      expect(await screen.findByText('ранняя заметка')).toBeTruthy();
      expect(api.getTherapistNote).toHaveBeenCalledWith(42, 900);
      const row = container.querySelector('.tb-tl-row--focus')!;
      expect(row.textContent).toContain('Сессия 3');
      expect(row.nextElementSibling).toBeNull(); // раньше всех показанных — в конце
      expect(scroll).toHaveBeenCalled();
    });

    it('не загрузилась — строка об этом и «Повторить» грузит снова', async () => {
      vi.mocked(api.getTherapistNote).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ note: early, number: 3 });
      open();
      expect(await screen.findByText('Запись не загрузилась.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
      expect(await screen.findByText('ранняя заметка')).toBeTruthy();
    });

    it('запись среди показанных ручку не зовёт', () => {
      vi.mocked(api.getTherapistNote).mockClear();
      render(<SessionArchive page={{ notes: rows(3), total: 3 }} removeNote={vi.fn()} takeFocus={() => 2} clientId={42} />);
      expect(api.getTherapistNote).not.toHaveBeenCalled();
    });
  });
});
