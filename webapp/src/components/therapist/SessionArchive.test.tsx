// @vitest-environment jsdom
// Находка аудита 2026-10: сервер отдаёт максимум 100 заметок, а кабинет рисовал
// срез как полный список: счётчик и «Сессия N» считались от среза. Теперь
// счётчик и номера идут от total, а над списком стоит строка о срезе.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionArchive } from './SessionArchive';
import type { TherapistNote } from '../../api';

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

  it('пустая история: «Заметок пока нет», без строки о срезе', () => {
    render(<SessionArchive page={{ notes: [], total: 0 }} removeNote={vi.fn()} />);
    expect(screen.getByText('Заметок пока нет')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
