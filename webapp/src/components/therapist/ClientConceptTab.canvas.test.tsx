// @vitest-environment jsdom
// «Открыть на холсте» во вкладке «Концептуализация»: схема случая, которую видит
// терапевт, становится новой картой режимов. Тест идёт по всей цепочке на
// НАСТОЯЩЕМ useClientDetail (мок только сети): кнопка → граф из живого источника
// (с несохранёнными правками) → create → update с нодами → событие → переход.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';

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
import { api, reportClientError } from '../../api';
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

async function openTab(props: { withHandler?: boolean; form?: AddressForm } = {}) {
  render(
    <AddressFormContext.Provider value={{ form: props.form ?? 'ty', setForm: vi.fn() }}>
      <Harness withHandler={props.withHandler} />
    </AddressFormContext.Provider>,
  );
  await screen.findByText('Концептуализация');
}

// Действие живёт в меню «⋯ Ещё» шапки (#879); выбор пункта закрывает меню,
// поэтому каждый вызов открывает его заново.
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Ещё действия' }));
const canvasBtn = () => {
  openMore();
  return screen.getByRole('menuitem', { name: /холсте/ });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
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
});
afterEach(() => cleanup());

describe('«Открыть на холсте»: где есть кнопка', () => {
  it('в виде «Схема» в меню «⋯ Ещё», с подсказкой, что она делает', async () => {
    await openTab();
    expect(screen.queryByRole('button', { name: /холсте/ })).toBeNull();
    const btn = canvasBtn();
    expect(btn.firstElementChild!.textContent).toBe('Открыть на холсте');
    // Подсказка — строкой под названием, видна без наведения (не в title).
    expect(within(btn).getByText(/Новая карта режимов из этой схемы: можно двигать фигуры/)).toBeTruthy();
    expect(btn.title).toBe('');
  });

  it('вкладке некуда вести (нет onOpenCanvas) — кнопки нет, «Скачать картинкой» остаётся', async () => {
    await openTab({ withHandler: false });
    openMore();
    expect(screen.queryByRole('menuitem', { name: /холсте/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Скачать картинкой/ })).toBeTruthy();
  });

  it('в виде «Поля» кнопки нет', async () => {
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    openMore();
    expect(screen.queryByRole('menuitem', { name: /холсте/ })).toBeNull();
  });
});

describe('«Открыть на холсте»: создание карты', () => {
  it('create → update с нодами схемы → событие → переход на созданную карту', async () => {
    await openTab();
    fireEvent.click(canvasBtn());
    await waitFor(() => expect(onOpenCanvas).toHaveBeenCalledWith(41));

    const [clientId, title, kind] = mockApi.createModeMap.mock.calls[0];
    expect([clientId, kind]).toEqual([7, 'personality']);
    expect(title).toMatch(/^Схема случая · \d{1,2} \S+\.?$/);

    const [mapId, body] = mockApi.updateModeMap.mock.calls[0];
    expect(mapId).toBe(41);
    const types = body.nodes.map((n: { type: string }) => n.type);
    expect(types).toEqual(expect.arrayContaining(['critic', 'schema', 'needs', 'need']));
    expect(body.edges.length).toBeGreaterThan(0);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_canvas_open');
    // порядок: событие и переход — только после того, как карта сохранена
    expect(mockApi.updateModeMap.mock.invocationCallOrder[0]).toBeLessThan(mockApi.trackEvent.mock.invocationCallOrder.at(-1)!);
  });

  it('граф берётся из того, что видит терапевт: правка имени, ещё не доехавшая до сервера, попадает на карту', async () => {
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Карающий Критик: связи' }));
    fireEvent.change(screen.getByLabelText('Как называет клиент'), { target: { value: 'Судья Иванов' } });
    fireEvent.click(canvasBtn());
    await waitFor(() => expect(onOpenCanvas).toHaveBeenCalled());

    const critic = mockApi.updateModeMap.mock.calls[0][1].nodes.find((n: { type: string }) => n.type === 'critic');
    expect(critic.data.label).toBe('Судья Иванов');
    expect(critic.data.note).toBe('Ты опять всё испортил');
  });

  it('пока карта создаётся, под шапкой строка словами, а пункт меню занят', async () => {
    let finish!: (v: unknown) => void;
    mockApi.createModeMap.mockReturnValue(new Promise((r) => { finish = r; }));
    await openTab();
    fireEvent.click(canvasBtn());
    expect(await screen.findByText('Переношу на холст…')).toBeTruthy();
    expect((canvasBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    finish({ id: 5 });
    await waitFor(() => expect(onOpenCanvas).toHaveBeenCalledWith(5));
    expect((canvasBtn() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('«Открыть на холсте»: отказ', () => {
  it('create упал — сообщение, переход не случился, события нет, отказ в телеметрии', async () => {
    mockApi.createModeMap.mockRejectedValue(new Error('500'));
    await openTab();
    fireEvent.click(canvasBtn());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Не получилось перенести на холст. Попробуй ещё раз.');
    expect(onOpenCanvas).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith('concept_canvas_open');
    expect(mockApi.deleteModeMap).not.toHaveBeenCalled();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'therapist.conceptCanvas' }),
    );
    expect((canvasBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it('update упал — пустая карта удаляется, чтобы повтор не оставил вторую рядом', async () => {
    mockApi.updateModeMap.mockRejectedValue(new Error('500'));
    await openTab();
    fireEvent.click(canvasBtn());
    await screen.findByRole('alert');
    expect(mockApi.deleteModeMap).toHaveBeenCalledWith(41);
    expect(onOpenCanvas).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith('concept_canvas_open');
  });

  it('форма «вы»: сообщение об отказе тоже на «вы»', async () => {
    mockApi.createModeMap.mockRejectedValue(new Error('500'));
    await openTab({ form: 'vy' });
    fireEvent.click(canvasBtn());
    expect((await screen.findByRole('alert')).textContent).toBe('Не получилось перенести на холст. Попробуйте ещё раз.');
  });

  it('повторная попытка после отказа снимает сообщение', async () => {
    mockApi.createModeMap.mockRejectedValueOnce(new Error('500'));
    await openTab();
    fireEvent.click(canvasBtn());
    await screen.findByRole('alert');
    fireEvent.click(canvasBtn());
    await waitFor(() => expect(onOpenCanvas).toHaveBeenCalledWith(41));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
