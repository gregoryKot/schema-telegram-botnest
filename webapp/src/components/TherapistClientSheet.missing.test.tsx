// @vitest-environment jsdom
// Карточка по адресу /cabinet/<код>, когда клиента нет (QA 2026-10-26):
// ссылка на удалённого, чужого или выдуманного клиента давала пустой экран,
// а удалённый клиент по «Назад» в браузере снова открывался полной карточкой
// (и «переименовывался» — бэкенд отвечал 201). Обвязка повторяет AppSections:
// вид и код клиента (или старый числовой id) живут в адресе.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { TherapistClientSheet } from './TherapistClientSheet';
import type { TherapyClientSummary } from '../api';
import { parseClientRef } from '../../../shared/src/utils/clientRef';
import { openClientRoute } from './appShell/navigation';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(), getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(), getTherapyClientData: vi.fn(), getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(), getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(),
    getAllTherapyTasks: vi.fn(), removeClient: vi.fn(), renameClient: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const offline = {
  telegramId: -142, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
  nextSession: null, meetingDays: [], schemaIds: [],
} as TherapyClientSummary;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  for (const fn of ['getClientSchemaNotes', 'getClientModeNotes', 'getTherapyClientHistory', 'getClientDiary']) mockApi[fn].mockResolvedValue([]);
});
afterEach(cleanup);

function RoutedSheet() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const openClientRef = parseClientRef(pathname.match(/^\/cabinet\/([^/]+)$/)?.[1]);
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <button onClick={() => nav(-1)}>браузер: назад</button>
      <TherapistClientSheet
        view={openClientRef ? 'client' : 'list'}
        openClientRef={openClientRef}
        onViewChange={(v) => { if (v === 'list') nav('/cabinet'); }}
        onOpenClient={(id) => { const r = openClientRoute(pathname, id, clients); if (r) nav(r.to); }}
        onClientsChange={setClients}
        onClose={vi.fn()}
      />
    </>
  );
}
const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><RoutedSheet /></MemoryRouter>);

describe('карточка клиента, которого нет', () => {
  it('выдуманный id — «Клиент не найден» и переход к списку клиентов', async () => {
    mockApi.getTherapyClients.mockResolvedValue([offline]);
    renderAt('/cabinet/999');
    await screen.findByText('Клиент не найден');
    fireEvent.click(screen.getByRole('button', { name: 'К списку клиентов' }));
    expect(screen.getByTestId('path').textContent).toBe('/cabinet');
    await screen.findByRole('heading', { level: 1, name: /Клиенты/ });
  });

  it('пока список клиентов грузится — скелетон карточки, а не «не найден»', async () => {
    let resolve!: (v: TherapyClientSummary[]) => void;
    mockApi.getTherapyClients.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderAt('/cabinet/999');
    expect(screen.getByTestId('client-card-skeleton')).toBeTruthy();
    expect(screen.queryByText('Клиент не найден')).toBeNull();
    await act(async () => resolve([]));
    expect(screen.getByText('Клиент не найден')).toBeTruthy();
  });

  it('список не загрузился — сбой, а не «не найден»', async () => {
    mockApi.getTherapyClients.mockRejectedValue(new Error('offline'));
    renderAt('/cabinet/-142');
    await screen.findByText('Карточка не открылась');
    expect(screen.queryByText('Клиент не найден')).toBeNull();
  });

  it('удалил клиента → «Назад» в браузере не оживляет карточку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([offline]);
    mockApi.removeClient.mockResolvedValue(undefined);
    renderAt('/cabinet/-142');
    fireEvent.click(await screen.findByRole('button', { name: 'Действия с карточкой' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить клиента' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Удалить' })); });
    expect(mockApi.removeClient).toHaveBeenCalledWith(-142);
    expect(screen.getByTestId('path').textContent).toBe('/cabinet');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'браузер: назад' })); });
    expect(screen.getByTestId('path').textContent).toBe('/cabinet/-142');
    expect(screen.getByText('Клиент не найден')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Действия с карточкой' })).toBeNull();
  });
});

// Адрес карточки — постоянный код (shared/src/utils/clientRef.ts): у офлайн-клиента
// id менялся при подключении карточки к аккаунту, и старая ссылка вела в никуда.
describe('карточка по коду в адресе', () => {
  const coded = { ...offline, urlCode: 'abcdefgh' } as TherapyClientSummary;
  const boris = { ...offline, telegramId: 7, name: 'Борис', urlCode: 'qrspnmkj' } as TherapyClientSummary;

  it('адрес с кодом открывает карточку именно этого клиента', async () => {
    mockApi.getTherapyClients.mockResolvedValue([boris, coded]);
    renderAt('/cabinet/abcdefgh');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Анна');
    expect(screen.getByTestId('path').textContent).toBe('/cabinet/abcdefgh');
  });

  it('старый числовой адрес тоже открывает карточку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([boris, coded]);
    renderAt('/cabinet/-142');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Анна');
  });

  it('чужой код — «Клиент не найден»', async () => {
    mockApi.getTherapyClients.mockResolvedValue([boris, coded]);
    renderAt('/cabinet/bbbbbbbb');
    await screen.findByText('Клиент не найден');
  });
});
