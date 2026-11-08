// @vitest-environment jsdom
// Карточка клиента и вкладки кабинета живут в адресе (владелец, 2026-11):
// /cabinet/<код>[/<вкладка>], доска «Задания» — /cabinet/tasks. Код постоянный —
// у офлайн-клиента id менялся при подключении карточки к аккаунту, и старая
// ссылка вела в никуда. Обвязка — настоящие AppSections и лист кабинета: адрес,
// канонический редирект и «← Все клиенты» работают так же, как в приложении.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { AppSections } from './appShell/AppSections';
import './TherapistClientSheet'; // лист у AppSections ленивый: модуль заранее, чтобы первый тест не ждал сборку чанка
import type { TherapyClientSummary } from '../api';
import { parseClientRef } from '../../../shared/src/utils/clientRef';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(), getTherapyInvites: vi.fn(() => Promise.resolve([])), getCardClaims: vi.fn(() => Promise.resolve([])), getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(), getConceptualization: vi.fn(), getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(), getTherapyClientHistory: vi.fn(),
    getClientDiary: vi.fn(), getAllTherapyTasks: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const anna = {
  telegramId: -142, urlCode: 'abcdefgh', name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
  nextSession: null, meetingDays: [], schemaIds: [],
} as TherapyClientSummary;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyClients.mockResolvedValue([anna]);
  mockApi.getAllTherapyTasks.mockResolvedValue([]);
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  for (const fn of ['getClientSchemaNotes', 'getClientModeNotes', 'getTherapyClientHistory', 'getClientDiary']) mockApi[fn].mockResolvedValue([]);
});
afterEach(cleanup);

function Host() {
  const loc = useLocation();
  const nav = useNavigate();
  const back = useRef(() => {});
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const seg = loc.pathname.split('/')[2];
  return (
    <>
      <span data-testid="path">{loc.pathname}</span>
      <span data-testid="state">{JSON.stringify(loc.state ?? null)}</span>
      <button onClick={() => nav(-1)}>браузер: назад</button>
      <button onClick={() => nav('/cabinet/abcdefgh')}>ссылка: обзор Анны</button>
      <AppSections
        inert={false} therapistMode pathname={loc.pathname} section="today" needs={[]} ratings={{}} displayName={null}
        navigate={nav} openClientRef={seg === 'today' ? null : parseClientRef(seg)} clients={clients}
        switchTherapistMode={() => {}} therapistBackHandlerRef={back} setTherapistClients={setClients}
        setSection={() => {}} ov={{} as never} todayRefreshKey={0} userRole="THERAPIST"
        profileRefreshKey={0} childhoodRatings={{}} helpTasksKey={0} setHelpTasksKey={() => {}}
      />
    </>
  );
}
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Host /></MemoryRouter>);
const path = () => screen.getByTestId('path').textContent;
const selectedTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

describe('адрес карточки клиента: код и вкладка', () => {
  it('прямой вход /cabinet/<код>/tasks открывает карточку на «Заданиях», адрес не меняется', async () => {
    renderAt('/cabinet/abcdefgh/tasks');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Анна');
    expect(selectedTab()).toMatch(/^Задания/);
    expect(path()).toBe('/cabinet/abcdefgh/tasks');
  });

  it('старый числовой адрес с вкладкой заменяется кодом, вкладка остаётся', async () => {
    renderAt('/cabinet/-142/tasks');
    await screen.findByRole('heading', { level: 1 });
    await act(async () => {});
    expect(path()).toBe('/cabinet/abcdefgh/tasks');
    expect(selectedTab()).toMatch(/^Задания/);
  });

  it('вкладка пишет адрес без новой записи: «← Все клиенты» возвращает к списку, а не на прошлую вкладку', async () => {
    renderAt('/cabinet');
    fireEvent.click(await screen.findByText('Анна'));
    expect(path()).toBe('/cabinet/abcdefgh');
    fireEvent.click(screen.getByRole('tab', { name: /^Сессии/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Задания/ }));
    await act(async () => {});
    expect(path()).toBe('/cabinet/abcdefgh/tasks');
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({ fromList: true });
    await act(async () => { fireEvent.click(screen.getByText('← Все клиенты')); });
    expect(path()).toBe('/cabinet');
  });

  it('адрес сменил вкладку у открытой карточки — карточка за ним', async () => {
    renderAt('/cabinet/abcdefgh/tasks');
    await screen.findByRole('heading', { level: 1 });
    await act(async () => { fireEvent.click(screen.getByText('ссылка: обзор Анны')); });
    expect(selectedTab()).toBe('Обзор');
    expect(path()).toBe('/cabinet/abcdefgh');
  });

  it('неизвестная вкладка в адресе — «Обзор»', async () => {
    renderAt('/cabinet/abcdefgh/nope');
    await screen.findByRole('heading', { level: 1 });
    expect(selectedTab()).toBe('Обзор');
  });
});

describe('вкладки списка: «Задания» — /cabinet/tasks', () => {
  it('прямой вход на /cabinet/tasks открывает доску и грузит её один раз', async () => {
    renderAt('/cabinet/tasks');
    await act(async () => {});
    expect(screen.getByRole('tab', { name: 'Задания' }).getAttribute('aria-selected')).toBe('true');
    expect(mockApi.getAllTherapyTasks).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Анна' })).toBeNull();
  });

  it('задание с доски открывает карточку на «Заданиях», и адрес несёт вкладку', async () => {
    mockApi.getAllTherapyTasks.mockResolvedValue([{ clientId: -142, clientName: 'Анна', tasks: [
      { id: 1, userId: -142, type: 'custom', text: 'Дневник режимов', status: 'pending', dueDate: null, createdAt: '2026-11-01T00:00:00Z' },
    ] }]);
    renderAt('/cabinet/tasks');
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('Дневник режимов')); });
    await act(async () => {});
    expect(selectedTab()).toBe('Задания');
    expect(path()).toBe('/cabinet/abcdefgh/tasks');
    expect(screen.getByTestId('state').textContent).toBe('{"fromList":true}');
  });

  it('кнопки вкладок меняют адрес, «Назад» возвращает прежнюю вкладку', async () => {
    renderAt('/cabinet');
    await screen.findByText('Анна');
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Задания' })); });
    expect(path()).toBe('/cabinet/tasks');
    expect(mockApi.getAllTherapyTasks).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByText('браузер: назад')); });
    expect(path()).toBe('/cabinet');
    expect(screen.getByRole('tab', { name: 'Клиенты' }).getAttribute('aria-selected')).toBe('true');
  });
});
