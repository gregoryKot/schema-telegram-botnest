// @vitest-environment jsdom
// Шапка вкладки «Концептуализация» после теста с терапевтом (#879): одно главное —
// заголовок, статус сохранения, «Схема · Поля»; остальное в меню «⋯ Ещё». Сверка
// с YSQ и история версий — свёрнутые раскрывашки под содержанием, а не правая
// колонка. В виде «Схема» корень вкладки несёт класс tcp--graph (узкие отступы,
// чтобы на ноутбуке схеме хватило ширины на четыре колонки). Поверх НАСТОЯЩЕГО
// useClientDetail, мок только сети.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { ysqFoldTitle, actionStatusText } from './concept/conceptHeadText';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const VERSION = {
  savedAt: '2026-07-01T00:00:00.000Z', schemaIds: ['failure'], modeIds: [],
  earlyExperience: 'старая версия', unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
};
const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7,
  schemaIds: ['failure'], modeIds: ['punitive_critic'],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [{ modeId: 'punitive_critic', alias: 'Судья', schemaIds: ['failure'], needIds: ['limits'], origin: '', manifest: '', strategy: '' }],
  schemaLinks: [], modeMapNodes: [], modeMapEdges: [],
  history: [VERSION, VERSION],
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

async function openTab(server: unknown = concept(), ysq: string[] = ['failure', 'abandonment', 'defectiveness']) {
  mockApi.getConceptualization.mockResolvedValue(server);
  mockApi.getTherapyClientData.mockResolvedValue({ ysqActiveSchemaIds: ysq, mySchemaIds: [] });
  render(<MemoryRouter><Harness /></MemoryRouter>);
  await screen.findByText('Концептуализация');
}

const more = () => screen.getByRole('button', { name: 'Ещё действия' });
const openMore = () => fireEvent.click(more());
const menu = () => screen.queryByRole('menu', { name: 'Ещё действия' });
const root = () => screen.getByText('Концептуализация').closest('.page-inner-wide')!;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => concept(body));
});
afterEach(() => cleanup());

// Название пункта — первая строка; под ней может стоять подсказка.
const itemLabel = (b: HTMLElement) => b.firstElementChild!.textContent;

describe('шапка: меню «⋯ Ещё»', () => {
  it('до открытия второстепенных кнопок в документе нет; кнопка меню подписана и объявляет меню', async () => {
    await openTab();
    for (const name of [/Экспорт/, /Скачать картинкой/, /На весь экран/, /холсте/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(more().getAttribute('aria-haspopup')).toBe('menu');
    expect(more().getAttribute('aria-expanded')).toBe('false');
    expect(menu()).toBeNull();
  });

  it('в виде «Схема» меню — экспорт, картинка, весь экран, холст; выбор закрывает меню', async () => {
    await openTab();
    openMore();
    expect(more().getAttribute('aria-expanded')).toBe('true');
    const items = within(menu()!).getAllByRole('menuitem').map(itemLabel);
    expect(items).toEqual(['↗ Экспорт текстом', '↓ Скачать картинкой', '⤢ На весь экран', 'Открыть на холсте']);
    // Подсказки — строкой под названием, не в title: видны без наведения.
    expect(within(menu()!).getByText(/четыре колонки/)).toBeTruthy();
    expect(within(menu()!).getByText(/Новая карта режимов из этой схемы/)).toBeTruthy();
    expect(within(menu()!).queryAllByTitle(/./)).toEqual([]);
    fireEvent.click(within(menu()!).getByRole('menuitem', { name: /На весь экран/ }));
    expect(menu()).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Схема случая' })).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_graph_fullscreen');
  });

  it('в виде «Поля» в меню только экспорт', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    openMore();
    expect(within(menu()!).getAllByRole('menuitem').map(itemLabel)).toEqual(['↗ Экспорт текстом']);
  });

  it('«Экспорт текстом» зовёт прежний экспорт: текст в буфере, под шапкой «Текст скопирован»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    await openTab();
    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: /Экспорт текстом/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Карающий Критик («Судья»)');
    expect((await screen.findByText('Текст скопирован')).getAttribute('role')).toBe('status');
  });

  it('Escape закрывает меню, фокус возвращается кнопке', async () => {
    await openTab();
    openMore();
    expect(menu()).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more());
    // лист при этом не открылся — Escape ушёл только меню
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('клик мимо меню закрывает его', async () => {
    await openTab();
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(menu()).toBeNull();
  });
});

describe('раскрывашки под содержанием', () => {
  it('свёрнуты по умолчанию, заголовок с числом; клик открывает, aria-expanded меняется', async () => {
    await openTab();
    const ysq = screen.getByRole('button', { name: 'Сверка с YSQ · 2 не в концептуализации' });
    const hist = screen.getByRole('button', { name: 'История версий · 2' });
    expect(ysq.getAttribute('aria-expanded')).toBe('false');
    expect(hist.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('+ добавить?')).toBeNull();
    expect(screen.queryByText('Версия 2')).toBeNull();

    fireEvent.click(ysq);
    expect(ysq.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('+ добавить?')).toHaveLength(2);
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();

    fireEvent.click(hist);
    expect(hist.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Версия 2')).toBeTruthy();
    // внутри раскрывашки второго заголовка «История версий» нет
    expect(screen.getAllByText(/История версий/)).toHaveLength(1);

    fireEvent.click(ysq);
    expect(ysq.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('+ добавить?')).toBeNull();
  });

  it('все схемы теста уже в концептуализации — «всё учтено»; теста нет — сверки нет', async () => {
    await openTab(concept(), ['failure']);
    expect(screen.getByRole('button', { name: 'Сверка с YSQ · всё учтено' })).toBeTruthy();
    cleanup();
    await openTab(concept({ history: [] }), []);
    expect(screen.queryByRole('button', { name: /Сверка с YSQ/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /История версий/ })).toBeNull();
  });

  it('раскрывашки есть и в виде «Поля»', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    expect(screen.getByRole('button', { name: 'Поля' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Сверка с YSQ/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'История версий · 2' })).toBeTruthy();
  });

  it('ysqFoldTitle: число не учтённых или «всё учтено»', () => {
    expect(ysqFoldTitle(3)).toBe('Сверка с YSQ · 3 не в концептуализации');
    expect(ysqFoldTitle(0)).toBe('Сверка с YSQ · всё учтено');
  });
});

describe('actionStatusText: строка под шапкой', () => {
  const tr = (ty: string) => ty;
  const idle = { busy: false, failed: false };
  const graph = (image = idle, canvas = idle) => ({ image: { ...image, download: () => {} }, canvas: { ...canvas, open: () => {} }, expand: () => {} });
  it('отказ важнее занятости, занятость важнее «скопировано»; без событий — пусто', () => {
    expect(actionStatusText(graph(), false, tr)).toBeNull();
    expect(actionStatusText(undefined, true, tr)).toEqual({ err: false, text: 'Текст скопирован' });
    expect(actionStatusText(graph({ busy: true, failed: false }), true, tr)).toEqual({ err: false, text: 'Готовлю картинку…' });
    expect(actionStatusText(graph(idle, { busy: true, failed: false }), false, tr)).toEqual({ err: false, text: 'Переношу на холст…' });
    expect(actionStatusText(graph({ busy: false, failed: true }, { busy: true, failed: false }), false, tr)?.err).toBe(true);
    expect(actionStatusText(graph(idle, { busy: false, failed: true }), false, tr)?.text).toMatch(/перенести на холст/);
  });
  it('форма «вы» — через tr', () => {
    const vy = (_: string, v: string) => v;
    expect(actionStatusText(graph({ busy: false, failed: true }), false, vy)?.text).toBe('Не удалось сохранить картинку. Попробуйте ещё раз.');
  });
});

describe('ширина под схему', () => {
  it('корень вкладки несёт tcp--graph в виде «Схема» и теряет его в «Полях»', async () => {
    await openTab();
    expect(root().classList.contains('tcp--graph')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(root().classList.contains('tcp--graph')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    expect(root().classList.contains('tcp--graph')).toBe(true);
  });

  it('над схемой нет панели действий: кнопки только в листе «На весь экран»', async () => {
    await openTab();
    expect(screen.queryByRole('button', { name: /Скачать картинкой/ })).toBeNull();
    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: /На весь экран/ }));
    const dialog = screen.getByRole('dialog', { name: 'Схема случая' });
    expect(within(dialog).getByRole('button', { name: /Скачать картинкой/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Открыть на холсте' }).title).toMatch(/Новая карта режимов/);
  });
});
