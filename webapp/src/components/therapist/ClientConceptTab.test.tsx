// @vitest-environment jsdom
// Вкладка «Концептуализация» кабинета терапевта (сайт): переключатель
// «Схема · Поля» и графическая концептуализация поверх НАСТОЯЩЕГО
// useClientDetail (мок только сети). Главное — связка сохранение→отображение:
// связь режима уходит в тело автосохранения, а ответ сервера с modeLinks
// рисуется на карточке; тест на «сохранилось ли» один зелёным остаётся и
// когда карточку потом не найти.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

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
  telegramId: 7,
  name: 'Анна',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
};

const LINK = {
  modeId: 'punitive_critic',
  alias: 'Судья',
  schemaIds: ['failure'],
  needIds: ['limits'],
  origin: 'строгий отец',
  manifest: '',
  strategy: '',
};

const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1,
  therapistId: 1,
  clientId: 7,
  schemaIds: ['failure'],
  modeIds: ['punitive_critic'],
  earlyExperience: null,
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: null,
  currentProblems: null,
  modeTransitions: null,
  modeLinks: [LINK],
  modeMapNodes: [],
  modeMapEdges: [],
  history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

function Harness() {
  const detail = useClientDetail({
    switchView: () => {},
    setClients: () => {},
  });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} />;
}

async function openTab(server: unknown) {
  mockApi.getConceptualization.mockResolvedValue(server);
  render(<Harness />);
  await screen.findByText('Концептуализация');
}

const saved = () => mockApi.saveConceptualization.mock.calls.at(-1)?.[1];
const card = (name: string) =>
  screen.getByRole('button', { name: `${name}: связи` });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  // сервер возвращает сохранённое тело как есть
  mockApi.saveConceptualization.mockImplementation(
    async (_id: number, body: object) => concept(body),
  );
});

afterEach(() => cleanup());

describe('ClientConceptTab: переключатель «Схема · Поля»', () => {
  it('режимов на карте нет — открываются «Поля»', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    expect(
      screen.getByRole('button', { name: 'Поля' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('Актуальные схемы')).toBeTruthy();
    expect(screen.queryByText(/Схема случая по модели режимов/)).toBeNull();
  });

  it('режимы на карте есть — открывается «Схема»; переключатель ходит туда и обратно', async () => {
    await openTab(concept());
    expect(
      screen
        .getByRole('button', { name: 'Схема' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText(/Схема случая по модели режимов/)).toBeTruthy();
    expect(screen.queryByText('Актуальные схемы')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(screen.getByText('Актуальные схемы')).toBeTruthy();
    expect(screen.getByText('Карта режимов')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    expect(screen.getByText(/Схема случая по модели режимов/)).toBeTruthy();
  });

  it('«Скачать картинкой» есть только в виде «Схема»', async () => {
    await openTab(concept());
    expect(
      screen.getByRole('button', { name: /Скачать картинкой/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(
      screen.queryByRole('button', { name: /Скачать картинкой/ }),
    ).toBeNull();
  });

  it('вид «Поля»: режим выбирается общим пикером и уходит в modeIds автосохранения', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    await waitFor(() => expect(saved()).toBeTruthy(), { timeout: 2500 });
    expect(saved().modeIds).toEqual(['vulnerable_child']);
    // и вид не перепрыгнул на схему посреди выбора
    expect(screen.getByText('Карта режимов')).toBeTruthy();
  });
});

describe('ClientConceptTab: схема — сохранение → отображение', () => {
  it('ответ сервера с modeLinks рисуется на карточке; легаси-ответ без modeLinks не роняет вкладку', async () => {
    await openTab(concept());
    expect(within(card('Карающий Критик')).getByText('Судья')).toBeTruthy();
    cleanup();

    const legacy = concept();
    delete (legacy as Partial<typeof legacy>).modeLinks;
    await openTab(legacy);
    expect(
      within(card('Карающий Критик')).getByText('связи не заполнены'),
    ).toBeTruthy();
  });

  it('правка имени → автосохранение шлёт modeLinks целиком → карточка показывает сохранённое', async () => {
    await openTab(concept());
    fireEvent.click(card('Карающий Критик'));
    fireEvent.change(screen.getByLabelText('Как называет клиент'), {
      target: { value: 'Судья Иванов' },
    });

    await waitFor(
      () => expect(mockApi.saveConceptualization).toHaveBeenCalled(),
      { timeout: 2500 },
    );
    expect(saved().modeLinks).toEqual([{ ...LINK, alias: 'Судья Иванов' }]);
    // остальные поля тела не потеряны
    expect(saved().schemaIds).toEqual(['failure']);
    expect(saved().modeIds).toEqual(['punitive_critic']);

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() =>
      expect(
        within(card('Карающий Критик')).getByText('Судья Иванов'),
      ).toBeTruthy(),
    );
  });

  it('связь нового режима: добавили на карту через «+ режим», заполнили → в теле оба режима и связь', async () => {
    await openTab(concept());
    const child = within(
      screen.getByRole('region', { name: 'Детские режимы' }),
    );
    fireEvent.click(child.getByRole('button', { name: '+ режим' }));
    fireEvent.click(child.getByRole('button', { name: /Одинокий Ребёнок/ }));
    fireEvent.click(card('Одинокий Ребёнок'));
    fireEvent.change(screen.getByLabelText('Как называет клиент'), {
      target: { value: 'Маленькая Аня' },
    });

    await waitFor(() => expect(saved()?.modeLinks).toHaveLength(2), {
      timeout: 2500,
    });
    expect(saved().modeIds).toEqual(['punitive_critic', 'lonely_child']);
    expect(saved().modeLinks.map((l: { modeId: string }) => l.modeId)).toEqual([
      'punitive_critic',
      'lonely_child',
    ]);
  });

  it('схема вне концептуализации из редактора связи попадает и в schemaIds', async () => {
    await openTab(concept());
    fireEvent.click(card('Карающий Критик'));
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: 'Все схемы' }));
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));

    await waitFor(
      () => expect(mockApi.saveConceptualization).toHaveBeenCalled(),
      { timeout: 2500 },
    );
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(saved().schemaIds).toEqual(['failure', 'abandonment']);
    expect(saved().modeLinks[0].schemaIds).toEqual(['failure', 'abandonment']);
  });
});

describe('ClientConceptTab: экспорт и аналитика', () => {
  it('текстовый экспорт содержит блок «РЕЖИМЫ: СВЯЗИ» с именем клиента', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    await openTab(concept());
    fireEvent.click(screen.getByRole('button', { name: /Экспорт/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('РЕЖИМЫ: СВЯЗИ');
    expect(text).toContain('Карающий Критик («Судья»)');
    expect(text).toContain('  Откуда: строгий отец');
  });

  it('экспорт без связей не печатает пустой блок', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    await openTab(concept({ modeLinks: [] }));
    fireEvent.click(screen.getByRole('button', { name: /Экспорт/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).not.toContain('РЕЖИМЫ: СВЯЗИ');
  });

  it('открытие схемы шлёт concept_graph_open; вид «Поля» событий не шлёт', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    expect(mockApi.trackEvent.mock.calls.map((c) => c[0])).toEqual([
      'concept_graph_open',
    ]);
  });
});
