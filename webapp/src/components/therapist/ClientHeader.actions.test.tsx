// @vitest-environment jsdom
// «+ Задание» и «+ Заметка» живут только в шапке карточки (на телефоне — панель
// над навигацией): дубли в сайдбаре «Обзора» убраны, чтобы на экране было одно
// место для главного действия. Тест держит оба конца: шапка ведёт куда надо,
// сайдбар дубль не вернул.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientHeader } from './ClientHeader';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

afterEach(cleanup);

const client = { telegramId: -1, name: 'Анна', clientAlias: null, streak: 0, meetingDays: [], nextSession: null } as unknown as TherapyClientSummary;
const detailOf = (o: Partial<ClientDetail> = {}) =>
  ({
    clientSchemaNotesData: [], clientModeNotesData: [], clientTasks: [], notesPage: { notes: [], total: 0 },
    clientData: null, clientDiary: [], clientHistory: [], clientTab: 'overview',
    renamingAlias: false, confirmingDelete: false, deleteLoading: false, deleteError: '',
    editingNextSession: false, editingStartDate: false, exportCopied: false,
    setShowAssign: vi.fn(), setClientTab: vi.fn(), handleExport: vi.fn(),
    ...o,
  }) as unknown as ClientDetail;

describe('действия карточки клиента', () => {
  it('шапка: «+ Задание» открывает назначение, «+ Заметка» — вкладку сессий', () => {
    const setShowAssign = vi.fn();
    const setClientTab = vi.fn();
    render(
      <MemoryRouter>
        <ClientHeader selectedClient={client} detail={detailOf({ setShowAssign, setClientTab })} switchView={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Задание' }));
    expect(setShowAssign).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '+ Заметка' }));
    expect(setClientTab).toHaveBeenCalledWith('sessions');
  });

  it('сайдбар «Обзора» не повторяет действия шапки', () => {
    render(<ClientOverviewSidebar selectedClient={client} detail={detailOf()} />);
    expect(screen.queryByRole('button', { name: /Задание/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Заметка/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Запросить YSQ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Экспорт концепта' })).toBeTruthy();
  });
});
