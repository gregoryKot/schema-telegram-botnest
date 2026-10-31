// @vitest-environment jsdom
// «На весь экран» во вкладке «Концептуализация»: схема случая открывается в листе
// на всё окно. Тест идёт по всей цепочке на НАСТОЯЩЕМ useClientDetail и настоящем
// useHistorySheet (MemoryRouter; мок только сети и html-to-image): кнопка → лист с тем
// же графом → правка тем же обработчиком → «Свернуть» → правка видна в потоке.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';

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
    createModeMap: vi.fn(),
    updateModeMap: vi.fn(),
    deleteModeMap: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
const toPng = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...a: unknown[]) => toPng(...a) }));
import { api } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const concept = () => ({
  id: 1, therapistId: 1, clientId: 7,
  schemaIds: ['failure'], modeIds: ['punitive_critic'],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [{
    modeId: 'punitive_critic', alias: 'Судья', schemaIds: ['failure'], needIds: ['limits'],
    origin: 'строгий отец', manifest: 'Ты опять всё испортил', strategy: '',
  }],
  schemaLinks: [], modeMapNodes: [], modeMapEdges: [], history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const onOpenCanvas = vi.fn();
const CIRCLE = 'Базовые эмоциональные потребности';

function Harness({ withHandler = true }: { withHandler?: boolean }) {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} onOpenCanvas={withHandler ? onOpenCanvas : undefined} />;
}

/** Нажатие «Назад» в браузере + след листа в истории (state.__sheetId есть, пока лист не свёрнут). */
function BrowserBack() {
  const navigate = useNavigate();
  const { state } = useLocation();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>браузерная назад</button>
      <output data-testid="history">{(state as { __sheetId?: string } | null)?.__sheetId ? 'лист в истории' : 'листа нет'}</output>
    </>
  );
}

async function openTab(withHandler = true) {
  render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <Harness withHandler={withHandler} />
        <BrowserBack />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByText('Концептуализация');
  await flushEffects();
}

/**
 * findBy/waitFor отпускают тест, как только узел появился в DOM, а useEffect графа
 * (concept_graph_open) React запускает отдельной задачей планировщика. Под нагрузкой
 * полного прогона счётчик читался раньше эффекта и был 0. act() дожидается эффектов.
 */
const flushEffects = () => act(async () => {});

// «На весь экран» — пункт меню «⋯ Ещё» шапки (#879); выбор закрывает меню,
// поэтому каждый вызов открывает его заново.
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Ещё действия' }));
const expandBtn = () => {
  openMore();
  return screen.getByRole('menuitem', { name: /На весь экран/ });
};
const sheet = () => screen.queryByRole('dialog', { name: 'Схема случая' });
const trackedCount = (name: string) => mockApi.trackEvent.mock.calls.filter((c) => c[0] === name).length;
const history = () => screen.getByTestId('history').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.getConceptualization.mockResolvedValue(concept());
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => ({ ...concept(), ...body }));
  mockApi.createModeMap.mockResolvedValue({ id: 41, title: 'x', kind: 'personality' });
  mockApi.updateModeMap.mockResolvedValue({});
  mockApi.deleteModeMap.mockResolvedValue(undefined);
  toPng.mockResolvedValue('data:image/png;base64,AAAA');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('«На весь экран»: открытие и закрытие', () => {
  it('в потоке пункт в меню «⋯ Ещё»; листа нет, пока его не выбрали', async () => {
    await openTab();
    expect(screen.queryByRole('button', { name: /На весь экран/ })).toBeNull();
    expect(expandBtn().firstElementChild!.textContent).toBe('⤢ На весь экран'); // вторая строка пункта — подсказка
    expect(sheet()).toBeNull();
  });

  it('кнопка открывает лист, «Свернуть» закрывает его и возвращает схему в поток', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    const dialog = sheet()!;
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Схема случая' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Свернуть' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(expandBtn()).toBeTruthy();
    expect(screen.getAllByText(CIRCLE).length).toBeGreaterThan(0);
  });

  it('«Свернуть» — обычная кнопка дизайн-системы (44px), а не компактная «sm» (40px)', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    const btn = within(sheet()!).getByRole('button', { name: 'Свернуть' });
    expect(btn.className).toContain('ds-btn');
    expect(btn.className).not.toContain('ds-btn--sm');
  });

  it('внутри листа нет второй кнопки «На весь экран»', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    expect(within(sheet()!).queryByRole('button', { name: /На весь экран/ })).toBeNull();
  });

  it('лист закрывается и «Назад» браузера, и Escape; история не остаётся висеть', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    expect(history()).toBe('лист в истории');
    fireEvent.click(screen.getByRole('button', { name: 'браузерная назад' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(history()).toBe('листа нет');

    fireEvent.click(expandBtn());
    expect(sheet()).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(sheet()).toBeNull());
    expect(history()).toBe('листа нет');
  });

  it('«Свернуть» идёт через goBack: запись листа из истории убрана', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    expect(history()).toBe('лист в истории');
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Свернуть' }));
    await waitFor(() => expect(history()).toBe('листа нет'));
  });
});

describe('«На весь экран»: тот же граф', () => {
  it('в листе видна подпись круга, а в потоке за листом графа нет (не два экземпляра)', async () => {
    await openTab();
    const inFlow = screen.getAllByText(CIRCLE).length;
    fireEvent.click(expandBtn());
    const inSheet = within(sheet()!).getAllByText(CIRCLE).length;
    expect(inSheet).toBeGreaterThan(0);
    expect(screen.getAllByText(CIRCLE).length).toBe(inSheet);
    expect(inSheet).toBe(inFlow);
  });

  it('правка в листе идёт тем же обработчиком и видна в потоке после «Свернуть» (сохранил → нашёл)', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    const dialog = sheet()!;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Карающий Критик: связи' }));
    fireEvent.change(within(dialog).getByLabelText('Как называет клиент'), { target: { value: 'Судья Иванов' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Свернуть' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.getAllByText(/Судья Иванов/).length).toBeGreaterThan(0);

    // Автосохранение вкладки то же: связь с новым именем уходит в saveConceptualization.
    await waitFor(() => expect(mockApi.saveConceptualization).toHaveBeenCalled(), { timeout: 4000 });
    const body = mockApi.saveConceptualization.mock.calls.at(-1)![1] as { modeLinks: { alias: string }[] };
    expect(body.modeLinks[0].alias).toBe('Судья Иванов');
  });
});

describe('«На весь экран»: аналитика', () => {
  it('concept_graph_fullscreen уходит один раз на каждое открытие, без meta', async () => {
    await openTab();
    expect(trackedCount('concept_graph_fullscreen')).toBe(0);

    fireEvent.click(expandBtn());
    expect(trackedCount('concept_graph_fullscreen')).toBe(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_graph_fullscreen');

    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Свернуть' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(trackedCount('concept_graph_fullscreen')).toBe(1); // сворачивание событий не шлёт

    fireEvent.click(expandBtn());
    expect(trackedCount('concept_graph_fullscreen')).toBe(2);
  });

  it('граф монтируется заново, но concept_graph_open остаётся одним: открытие схемы то же', async () => {
    await openTab();
    expect(trackedCount('concept_graph_open')).toBe(1);
    fireEvent.click(expandBtn());
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Свернуть' }));
    await waitFor(() => expect(sheet()).toBeNull());
    await flushEffects(); // эффект заново смонтированного графа в потоке уже отработал
    expect(trackedCount('concept_graph_open')).toBe(1);
  });

  it('вид «Поля» → «Схема» заново считается новым открытием схемы', async () => {
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    expect(trackedCount('concept_graph_open')).toBe(2);
  });
});

describe('«На весь экран»: действия панели', () => {
  it('«Скачать картинкой» в листе снимает граф из листа, в потоке — граф из потока', async () => {
    await openTab();
    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: /Скачать картинкой/ }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    expect(toPng.mock.calls[0][0].textContent).toContain(CIRCLE);
    expect(toPng.mock.calls[0][0].closest('[role="dialog"]')).toBeNull();

    fireEvent.click(expandBtn());
    const dialog = sheet()!;
    fireEvent.click(within(dialog).getByRole('button', { name: /Скачать картинкой/ }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(2));
    expect(dialog.contains(toPng.mock.calls[1][0])).toBe(true);
    expect(toPng.mock.calls[1][0].textContent).toContain(CIRCLE);
  });

  it('«Открыть на холсте» из листа: карта создана, лист закрыт через goBack, переход выполнен', async () => {
    await openTab();
    fireEvent.click(expandBtn());
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Открыть на холсте' }));
    await waitFor(() => expect(onOpenCanvas).toHaveBeenCalledWith(41));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_canvas_open');
    await waitFor(() => expect(history()).toBe('листа нет'));
  });

  it('вкладке некуда вести (нет onOpenCanvas) — в листе нет «Открыть на холсте», «Скачать» остаётся', async () => {
    await openTab(false);
    fireEvent.click(expandBtn());
    expect(within(sheet()!).queryByRole('button', { name: /холсте/ })).toBeNull();
    expect(within(sheet()!).getByRole('button', { name: /Скачать картинкой/ })).toBeTruthy();
  });
});
