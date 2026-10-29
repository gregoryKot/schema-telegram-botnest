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
  schemaLinks: [],
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
// Второстепенные действия — в меню «⋯ Ещё» шапки (#879).
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Ещё действия' }));
const exportViaMenu = () => {
  openMore();
  fireEvent.click(screen.getByRole('menuitem', { name: /Экспорт текстом/ }));
};
const card = (name: string) =>
  screen.getByRole('button', { name: `${name}: связи` });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
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
    expect(screen.queryByText(/Схема случая: в центре базовые потребности/)).toBeNull();
  });

  it('режимы на карте есть — открывается «Схема»; переключатель ходит туда и обратно', async () => {
    await openTab(concept());
    expect(
      screen
        .getByRole('button', { name: 'Схема' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // инструкция на заполненной схеме свёрнута — открывается «Как читать схему»
    expect(screen.queryByText(/Схема случая: в центре базовые потребности/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Как читать схему/ }));
    expect(screen.getByText(/Схема случая: в центре базовые потребности/)).toBeTruthy();
    expect(screen.queryByText('Актуальные схемы')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(screen.getByText('Актуальные схемы')).toBeTruthy();
    expect(screen.getByText('Карта режимов')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    expect(screen.getByRole('button', { name: /Как читать схему/ })).toBeTruthy();
  });

  it('«Скачать картинкой» есть в меню «⋯ Ещё» только в виде «Схема»', async () => {
    await openTab(concept());
    openMore();
    expect(screen.getByRole('menuitem', { name: /Скачать картинкой/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    openMore();
    expect(screen.queryByRole('menuitem', { name: /Скачать картинкой/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Экспорт текстом/ })).toBeTruthy();
  });

  it('вид «Поля»: режим выбирается общим пикером и уходит в modeIds автосохранения', async () => {
    await openTab(concept({ modeIds: [], modeLinks: [] }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    await waitFor(() => expect(saved()).toBeTruthy(), { timeout: 2500 });
    expect(saved().modeIds).toEqual(['vulnerable_child']);
    // и вид не перепрыгнул на схему посреди выбора
    expect(screen.getByText('Карта режимов')).toBeTruthy();
  });

  it('вид «Поля» с выбранными режимами: чипы только выбранных, «Изменить» открывает пикер, клик по режиму уходит в modeIds', async () => {
    await openTab(concept());
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(screen.queryByRole('button', { name: /Уязвимый Ребёнок/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Изменить: Карта режимов/ }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    await waitFor(() => expect(saved()).toBeTruthy(), { timeout: 2500 });
    expect(saved().modeIds).toContain('vulnerable_child');
    expect(screen.getByRole('button', { name: /Готово: Карта режимов/ })).toBeTruthy();
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

  it('связь нового режима: добавили на карту через пустую клетку, заполнили → в теле оба режима и связь', async () => {
    await openTab(concept());
    // «+ режим» в колонке режимов предлагает режимы всех групп, кроме здоровых.
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Режимы' })).getByRole('button', {
        name: '+ режим',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Одинокий Ребёнок/ }));
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
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
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

describe('ClientConceptTab: тексты схем — правка → автосохранение → отображение', () => {
  const schemaButton = () =>
    screen.getByRole('button', { name: 'Схема Неуспешность: убеждение и опыт' });

  it('убеждение, опыт и блокируемая потребность схемы уходят в schemaLinks и рисуются на схеме', async () => {
    await openTab(concept());
    fireEvent.click(schemaButton());
    fireEvent.change(screen.getByLabelText('Во что человек верит'), {
      target: { value: 'Я не справлюсь' },
    });
    fireEvent.change(screen.getByLabelText('Как нарушалась потребность'), {
      target: { value: 'Критика за каждую ошибку' },
    });
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Какие потребности блокирует' }),
      ).getByRole('button', { name: /Автономия/ }),
    );

    await waitFor(
      () => expect(saved()?.schemaLinks?.[0]?.needIds).toEqual(['autonomy']),
      { timeout: 2500 },
    );
    expect(saved().schemaLinks).toEqual([
      {
        schemaId: 'failure',
        belief: 'Я не справлюсь',
        origin: 'Критика за каждую ошибку',
        needIds: ['autonomy'],
      },
    ]);
    // остальное тело на месте
    expect(saved().modeLinks).toEqual([LINK]);
    expect(saved().schemaIds).toEqual(['failure']);

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() =>
      expect(within(schemaButton()).getByText('Я не справлюсь')).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', {
        name: 'Как нарушалась потребность: схема Неуспешность',
      }),
    ).toBeTruthy();
    expect(document.querySelectorAll('[data-badge="block"]')).toHaveLength(1);
  });

  it('ответ сервера с schemaLinks рисуется на схеме; легаси-ответ без schemaLinks не роняет вкладку и шлёт []', async () => {
    await openTab(
      concept({
        schemaLinks: [
          { schemaId: 'failure', belief: 'Я хуже других', origin: '', needIds: [] },
        ],
      }),
    );
    expect(within(schemaButton()).getByText('Я хуже других')).toBeTruthy();
    cleanup();

    const legacy = concept();
    delete (legacy as Partial<typeof legacy>).schemaLinks;
    await openTab(legacy);
    expect(within(schemaButton()).getByText('связи не заполнены')).toBeTruthy();
    fireEvent.click(card('Карающий Критик'));
    fireEvent.change(screen.getByLabelText('Как называет клиент'), {
      target: { value: 'Судья Петров' },
    });
    await waitFor(
      () => expect(mockApi.saveConceptualization).toHaveBeenCalled(),
      { timeout: 2500 },
    );
    expect(saved().schemaLinks).toEqual([]);
  });

  it('«Убрать схему» снимает её из schemaIds автосохранением, тексты уходят в теле как были', async () => {
    await openTab(
      concept({
        schemaLinks: [
          { schemaId: 'failure', belief: 'Я хуже других', origin: '', needIds: [] },
        ],
      }),
    );
    fireEvent.click(schemaButton());
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать схему из концептуализации' }),
    );
    await waitFor(() => expect(saved()?.schemaIds).toEqual([]), {
      timeout: 2500,
    });
    expect(saved().schemaLinks[0].belief).toBe('Я хуже других');
  });

  it('боковой колонки нет ни в одном виде: вкладка в одну колонку (#879)', async () => {
    await openTab(concept());
    expect(document.querySelector('aside, .doc-grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(document.querySelector('aside, .doc-grid')).toBeNull();
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
    exportViaMenu();
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('РЕЖИМЫ: СВЯЗИ');
    expect(text).toContain('Карающий Критик («Судья»)');
    expect(text).toContain('  Откуда: строгий отец');
  });

  it('текстовый экспорт содержит блок «СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ» перед режимами', async () => {
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
    await openTab(
      concept({
        schemaLinks: [
          {
            schemaId: 'failure',
            belief: 'Я хуже других',
            origin: 'строгий отец',
            needIds: ['autonomy'],
          },
        ],
      }),
    );
    exportViaMenu();
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ');
    expect(text).toContain('  Убеждение: Я хуже других');
    expect(text).toContain('  Блокирует потребности: Автономия');
    expect(text.indexOf('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ')).toBeLessThan(
      text.indexOf('РЕЖИМЫ: СВЯЗИ'),
    );
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
    exportViaMenu();
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).not.toContain('РЕЖИМЫ: СВЯЗИ');
    expect(writeText.mock.calls[0][0]).not.toContain('СХЕМЫ: УБЕЖДЕНИЯ');
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
