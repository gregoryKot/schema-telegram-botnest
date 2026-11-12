// @vitest-environment jsdom
// Колесо потребностей на вкладке «Концептуализация»: оценки концептуализации
// (`needLinks`, их ставят на холсте) доходят до вида «Схема» — таблетка круга
// залита на процент и несёт число, период переключается над подписью круга.
// Без колеса (старый кэш, ничего не оценено) схема прежняя, а в «Как читать
// схему» стоит строка, где проценты ставят. Поверх НАСТОЯЩЕГО useClientDetail.
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
import { NEED_PCT_EMPTY } from '../../../../shared/src/therapy/conceptGraph/NeedPctHint';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7,
  schemaIds: ['failure'], modeIds: ['healthy_adult'],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [], schemaLinks: [], modeMapNodes: [], modeMapEdges: [], history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});
const WHEEL = [
  { needId: 'attachment', ratings: { child: 2, now: 5 }, notes: { now: 'Близкая подруга' } },
  { needId: 'limits', ratings: { now: 10 }, notes: {} },
];

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
  await screen.findByRole('button', { name: 'Ещё действия' });
  expect(screen.getByRole('button', { name: 'Схема' }).getAttribute('aria-pressed')).toBe('true');
}

const pill = (needId: string) => document.querySelector<HTMLElement>(`[data-node="need:${needId}"]`)!;
const pct = (needId: string) => pill(needId).querySelector('[data-need-pct]')?.textContent ?? null;
const periods = () => screen.queryByRole('group', { name: 'Период оценок потребностей' });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe('ClientConceptTab: проценты колеса потребностей в виде «Схема»', () => {
  it('оценки концептуализации доходят до таблеток круга: заливка и число за «Сейчас»', async () => {
    await openTab(concept({ needLinks: WHEEL }));
    expect(pct('attachment')).toBe('50%');
    expect(pct('limits')).toBe('100%');
    expect(pill('attachment').querySelector<HTMLElement>('[data-need-fill] > span')!.style.width).toBe('50%');
    expect(pill('attachment').title).toBe('Привязанность: детство 20%, сейчас 50%');
    expect(pct('autonomy')).toBeNull(); // не оценена — без числа, не «0%»
  });

  it('переключатель периода меняет числа; выбор не уходит на сервер', async () => {
    await openTab(concept({ needLinks: WHEEL }));
    fireEvent.click(within(periods()!).getByRole('button', { name: 'Детство' }));
    expect(pct('attachment')).toBe('20%');
    expect(pct('limits')).toBeNull();
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
  });

  it('колеса нет (старый кэш) или оно пустое — схема прежняя, в «Как читать схему» строка, где ставят проценты', async () => {
    await openTab(concept());
    expect(periods()).toBeNull();
    expect(document.querySelector('[data-need-pct], [data-need-fill]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Как читать схему' }));
    expect(screen.getByText(NEED_PCT_EMPTY)).toBeTruthy();
    cleanup();
    await openTab(concept({ needLinks: [] }));
    expect(periods()).toBeNull();
  });

  it('сырое колесо с сервера нормализуется: чужая потребность и оценка вне 0–10 не рисуются', async () => {
    await openTab(concept({ needLinks: [
      { needId: 'attachment', ratings: { now: 12 }, notes: {} },
      { needId: 'nope', ratings: { now: 4 }, notes: {} },
      { needId: 'play', ratings: { now: 3 } },
    ] }));
    expect(pct('attachment')).toBeNull();
    expect(pct('play')).toBe('30%');
  });
});
