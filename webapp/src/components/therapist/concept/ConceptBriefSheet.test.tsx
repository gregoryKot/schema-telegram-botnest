// @vitest-environment jsdom
// Экран «Главное» (2026-11): кнопка в шапке вкладки «Концептуализация» открывает лист с
// самым важным на одном экране; блоки выбирает терапевт чипами, выбор живёт в localStorage
// и переживает закрытие листа (сохранил → нашёл); «Закрыть» идёт через goBack
// (useHistorySheet); открытие считает concept_brief_open. Поверх НАСТОЯЩЕГО useClientDetail,
// мок только сети.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../api', () => ({
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
import { api } from '../../../api';
import { ClientConceptTab } from '../ClientConceptTab';
import { useClientDetail } from '../useClientDetail';
import { BRIEF_BLOCKS_KEY } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { CONCEPT_BRIEF_OPEN_EVENT } from '../../../../../shared/src/share/analytics';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const link = (modeId: string, patch: Record<string, unknown> = {}) => ({
  modeId, alias: '', schemaIds: [], needIds: [], origin: '', manifest: '', strategy: '', ...patch,
});
const concept = () => ({
  id: 1, therapistId: 1, clientId: 7,
  schemaIds: ['failure'], modeIds: ['punitive_critic', 'healthy_adult'],
  earlyExperience: 'Отец сравнивал с братом', unmetNeeds: null, triggers: null, copingStyles: null,
  goals: 'Снизить тревогу перед работой', currentProblems: null,
  modeTransitions: 'Критика → Судья → уход в себя',
  modeLinks: [link('punitive_critic', { alias: 'Судья', schemaIds: ['failure'], manifest: 'Ты опять всё испортил' }), link('healthy_adult', { needIds: ['limits'] })],
  schemaLinks: [{ schemaId: 'failure', belief: '', origin: '', needIds: ['autonomy'] }],
  modeMapNodes: [], modeMapEdges: [], history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
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

async function openTab() {
  mockApi.getConceptualization.mockResolvedValue(concept());
  render(<MemoryRouter><Harness /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Ещё действия' });
}
const briefBtn = () => screen.getByRole('button', { name: 'Главное' }); // имя — слово; иконка — SVG, не глиф
const sheet = () => screen.queryByRole('dialog', { name: 'Главное · Анна' });
const card = (name: string) => within(sheet()!).getByRole('region', { name });
const chip = (name: string) => within(within(sheet()!).getByRole('group', { name: 'Что показывать' })).getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => ({ ...concept(), ...body }));
});
afterEach(() => cleanup());

describe('ClientConceptTab: экран «Главное»', () => {
  it('кнопка в шапке (не в меню «⋯»); лист с карточками набора по умолчанию, пустой блок — «—»', async () => {
    await openTab();
    expect(sheet()).toBeNull();
    expect(briefBtn().closest('.tcp-head-actions')).toBeTruthy();
    fireEvent.click(briefBtn());
    expect(sheet()).toBeTruthy();
    // литерал в кнопке (трипваер analytics-sync) совпадает с константой shared
    expect(CONCEPT_BRIEF_OPEN_EVENT).toBe('concept_brief_open');
    expect(mockApi.trackEvent.mock.calls.filter((c) => c[0] === CONCEPT_BRIEF_OPEN_EVENT)).toHaveLength(1);
    const names = within(sheet()!).getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(names).toEqual(['Схемы', 'Режимы', 'Потребности', 'Переключение режимов', 'Цели терапии', 'Актуальные проблемы']);
    expect(within(card('Схемы')).getByText('Неуспешность').className).toBe('cg-tag');
    // бумагой — только листы свободного текста (не больше трёх-четырёх цветных на экране, соседние не ближе 40°);
    // схемы, режимы, потребности — белые карточки со знаком раздела у подписи
    for (const n of ['Схемы', 'Режимы', 'Потребности']) expect(card(n).className).toBe('tcp-brief-card tcp-brief-card--plain');
    const hues = ['Переключение режимов', 'Цели терапии', 'Актуальные проблемы'].map((n) => {
      expect(card(n).className).toBe('pp-paper tcp-brief-card');
      return Number(card(n).style.getPropertyValue('--h'));
    });
    expect(hues).toEqual([240, 145, 70]);
    expect(briefBtn().querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    // у режима — знак группы на плашке бумаги группы
    expect(card('Режимы').querySelector<HTMLElement>('.tcp-brief-mode-sign')!.style.getPropertyValue('--h')).not.toBe('');
    for (const r of within(sheet()!).getAllByRole('region')) expect(r.querySelector('.tcp-brief-label .pp-art--row')).toBeTruthy();
    expect(within(card('Режимы')).getByText('Судья (Карающий Критик)')).toBeTruthy();
    expect(within(card('Режимы')).getByText('Ты опять всё испортил')).toBeTruthy();
    expect(within(card('Режимы')).getByText('Схемы: Неуспешность')).toBeTruthy();
    expect(within(card('Цели терапии')).getByText('Снизить тревогу перед работой')).toBeTruthy();
    expect(within(card('Актуальные проблемы')).getByText('—')).toBeTruthy();
    // ранний опыт по умолчанию не показан, хотя заполнен
    expect(within(sheet()!).queryByText('Отец сравнивал с братом')).toBeNull();
    // только чтение: кнопки — чипы выбора и «Закрыть»
    for (const r of within(sheet()!).getAllByRole('region')) expect(within(r).queryByRole('button')).toBeNull();
  });

  it('выбор блоков чипами запоминается: закрыл, открыл — тот же набор (сохранил → нашёл)', async () => {
    await openTab();
    fireEvent.click(briefBtn());
    expect(chip('Ранний опыт').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip('Ранний опыт'));
    fireEvent.click(chip('Актуальные проблемы'));
    expect(within(card('Ранний опыт')).getByText('Отец сравнивал с братом')).toBeTruthy();
    expect(within(sheet()!).queryByRole('region', { name: 'Актуальные проблемы' })).toBeNull();
    expect(JSON.parse(localStorage.getItem(BRIEF_BLOCKS_KEY)!)).toEqual(['schemas', 'modes', 'needs', 'cycle', 'goals', 'early']);

    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Закрыть' }));
    expect(sheet()).toBeNull();
    fireEvent.click(briefBtn());
    expect(chip('Ранний опыт').getAttribute('aria-pressed')).toBe('true');
    expect(within(sheet()!).queryByRole('region', { name: 'Актуальные проблемы' })).toBeNull();
  });

  it('сняты все блоки — лист говорит об этом словами, а не пустотой', async () => {
    localStorage.setItem(BRIEF_BLOCKS_KEY, '[]');
    await openTab();
    fireEvent.click(briefBtn());
    expect(within(sheet()!).queryAllByRole('region')).toHaveLength(0);
    expect(within(sheet()!).getByText(/Ни один блок не выбран/)).toBeTruthy();
  });

  it('черновик сильнее сервера: правка цели в «Полях» видна в «Главном»', async () => {
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    fireEvent.change(screen.getByPlaceholderText(/Что должно измениться/), { target: { value: 'Вернуть злость' } });
    fireEvent.click(briefBtn());
    expect(within(card('Цели терапии')).getByText('Вернуть злость')).toBeTruthy();
  });
});
