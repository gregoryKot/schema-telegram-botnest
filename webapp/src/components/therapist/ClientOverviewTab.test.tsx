// @vitest-environment jsdom
// «Обзор» → блок «Карта режимов» показывает режимы из концептуализации, значит
// «Редактировать →» ведёт туда, где их правят, — во вкладку «Концептуализация»,
// а не на холст карт режимов (QA 2026-10-26: ссылка открывала пустой холст).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientOverviewTab } from './ClientOverviewTab';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

afterEach(cleanup);

const client = { telegramId: -1, name: 'Анна', clientAlias: null, streak: 0, meetingDays: [], nextSession: null } as unknown as TherapyClientSummary;

describe('ClientOverviewTab — блок режимов', () => {
  it('«Редактировать →» открывает концептуализацию', () => {
    const setClientTab = vi.fn();
    const detail = {
      localConcept: {}, concept: null, activeSchemaIds: [], activeModeIds: ['vulnerable_child', 'punitive_critic'],
      notes: [], clientDiary: [], clientTasks: [], clientHistory: [], clientData: null, notesPage: { notes: [], total: 0 },
      editingNextSession: false, editingStartDate: false, setClientTab, setShowAssign: vi.fn(),
    } as unknown as ClientDetail;
    render(<MemoryRouter><ClientOverviewTab selectedClient={client} detail={detail} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Редактировать →'));
    expect(setClientTab).toHaveBeenCalledWith('concept');
    expect(setClientTab).not.toHaveBeenCalledWith('mode_map');
  });
});
