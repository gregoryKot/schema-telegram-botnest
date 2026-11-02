// @vitest-environment jsdom
// Сводка «Коротко» на вкладке «Концептуализация» (#902): первое, что видно, — что
// с клиентом. Стоит под шапкой и над содержанием в обоих видах (до фигур схемы и
// до карточек «Полей»), строится из тех же данных, что и схема; при пустой
// концептуализации её нет. Поверх НАСТОЯЩЕГО useClientDetail, мок только сети.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(),
    getClientDiary: vi.fn(),
    saveConceptualization: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const link = (modeId: string, patch: Record<string, unknown> = {}) => ({
  modeId, alias: '', schemaIds: [], needIds: [], origin: '', manifest: '', strategy: '', ...patch,
});
const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7,
  schemaIds: ['failure'], modeIds: ['punitive_critic', 'healthy_adult'],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: 'Снизить тревогу перед работой', currentProblems: null,
  modeTransitions: 'Критика → Судья → уход в себя',
  modeLinks: [link('punitive_critic', { alias: 'Судья', schemaIds: ['failure'] }), link('healthy_adult', { needIds: ['limits'] })],
  schemaLinks: [{ schemaId: 'failure', belief: '', origin: '', needIds: ['autonomy'] }],
  modeMapNodes: [], modeMapEdges: [], history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

function Harness() {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} onOpenCanvas={() => {}} />;
}

async function openTab(server: unknown) {
  mockApi.getConceptualization.mockResolvedValue(server);
  render(<MemoryRouter><Harness /></MemoryRouter>);
  await screen.findByText('Концептуализация');
}

const digest = () => screen.getByRole('region', { name: 'Коротко' });
const head = () => document.querySelector('.tcp-head')!;
const isBefore = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const value = (label: string) =>
  within(digest()).getByText(label).nextElementSibling?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => concept(body));
});
afterEach(() => cleanup());

describe('ClientConceptTab: сводка «Коротко»', () => {
  it('вид «Схема»: сводка под шапкой и до первой фигуры, строки из данных концептуализации', async () => {
    await openTab(concept());
    expect(screen.getByRole('button', { name: 'Схема' }).getAttribute('aria-pressed')).toBe('true');
    expect(value('Схемы')).toBe('Неуспешность');
    expect(value('Режимы')).toBe('Судья (Карающий Критик) → Здоровый Взрослый');
    expect(value('Цикл')).toBe('Критика → Судья → уход в себя');
    expect(value('Потребности')).toBe('✗ блокированы: Автономия · ✓ есть опора: Границы');
    expect(value('Цель')).toBe('Снизить тревогу перед работой');
    const figure = screen.getByRole('button', { name: 'Карающий Критик: связи' });
    expect(isBefore(head(), digest())).toBe(true);
    expect(isBefore(digest(), figure)).toBe(true);
    // сводка — только чтение и в картинку схемы не идёт
    expect(within(digest()).queryByRole('button')).toBeNull();
    expect(digest().hasAttribute('data-export-skip')).toBe(true);
  });

  it('вид «Поля»: та же сводка под шапкой и до карточек полей', async () => {
    await openTab(concept());
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(value('Режимы')).toBe('Судья (Карающий Критик) → Здоровый Взрослый');
    expect(isBefore(head(), digest())).toBe(true);
    expect(isBefore(digest(), screen.getByText('Актуальные схемы'))).toBe(true);
  });

  it('черновик сильнее сервера: правка цели в «Полях» меняет строку «Цель»', async () => {
    await openTab(concept());
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    fireEvent.change(screen.getByPlaceholderText(/Что должно измениться/), { target: { value: 'Вернуть злость' } });
    expect(value('Цель')).toBe('Вернуть злость');
  });

  it('пустая концептуализация — сводки нет (и пустая серверная, и отсутствующая)', async () => {
    await openTab(concept({
      schemaIds: [], modeIds: [], modeLinks: [], schemaLinks: [], goals: null, modeTransitions: null,
    }));
    expect(screen.queryByRole('region', { name: 'Коротко' })).toBeNull();
    cleanup();
    await openTab(null);
    expect(screen.queryByRole('region', { name: 'Коротко' })).toBeNull();
  });
});
