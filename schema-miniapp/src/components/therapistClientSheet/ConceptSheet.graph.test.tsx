// @vitest-environment jsdom
// Лист концептуализации (мини-апп): переключатель «Схема · Поля» и схема
// случая поверх НАСТОЯЩЕГО useClientDetail (мок только сети). В мини-аппе
// сохранение — кнопкой, поэтому проверяем цепочку: правка связи → лист
// «грязный» → «Сохранить концептуализацию» → в теле modeLinks → ответ сервера
// рисуется на карточке. Файл схема не скачивает (WebView Telegram) — кнопки
// «Скачать картинкой» тут быть не должно.
import { useEffect, useRef } from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  act,
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
    saveConceptualization: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('./conceptSheet/ConceptHistoryPanel', () => ({
  ConceptHistoryPanel: () => null,
}));
vi.mock('./conceptSheet/ConceptYsqHistory', () => ({
  ConceptYsqHistory: () => null,
}));
import { api } from '../../api';
import { ConceptSheet } from './ConceptSheet';
import { useClientDetail } from '../therapist/useClientDetail';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
// Сервер возвращает сохранённое тело как есть — отдельный типизированный мок.
const saveMock = api.saveConceptualization as unknown as Mock<
  (id: number, body: object) => Promise<unknown>
>;

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
  modeLinks: [],
  schemaLinks: [],
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
    void detail.openClient(CLIENT);
  }, []);
  if (!detail.selectedClient || !detail.concept) return <div>загрузка</div>;
  return (
    <ConceptSheet selectedClient={detail.selectedClient} detail={detail} />
  );
}

async function openSheet(server: unknown) {
  mockApi.getConceptualization.mockResolvedValue(server);
  render(<Harness />);
  await screen.findByText('Концептуализация');
}

const card = (name: string) =>
  screen.getByRole('button', { name: `${name}: связи` });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  saveMock.mockImplementation(async (_id, body) => concept(body));
});
afterEach(() => cleanup());

describe('ConceptSheet: «Схема · Поля»', () => {
  it('режимов нет — «Поля», режимы есть — «Схема»', async () => {
    await openSheet(concept({ modeIds: [] }));
    expect(
      screen.getByRole('button', { name: 'Поля' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('Актуальные схемы (ЭДС)')).toBeTruthy();
    cleanup();

    await openSheet(concept());
    expect(
      screen
        .getByRole('button', { name: 'Схема' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // инструкция свёрнута, пока на схеме что-то есть
    expect(
      screen.queryByText(/Схема случая: в центре базовые потребности/),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Как читать схему/ }));
    expect(
      screen.getByText(/Схема случая: в центре базовые потребности/),
    ).toBeTruthy();
    expect(screen.queryByText('Актуальные схемы (ЭДС)')).toBeNull();
  });

  it('переключение на «Схему»: карточка режима, без кнопки скачивания картинки', async () => {
    await openSheet(concept({ modeIds: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Схема' }));
    // инструкция свёрнута, пока на схеме что-то есть
    expect(
      screen.queryByText(/Схема случая: в центре базовые потребности/),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Как читать схему/ }));
    expect(
      screen.getByText(/Схема случая: в центре базовые потребности/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Скачать картинкой/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(screen.getByText('Карта режимов')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Карающий Критик/ }),
    ).toBeTruthy();
  });

  it('вид «Поля»: общий пикер ставит режим, лист становится грязным', async () => {
    await openSheet(concept({ modeIds: [] }));
    expect(
      screen.getByRole('button', { name: /Нет изменений|Сохранено/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    expect(
      screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
    ).toBeTruthy();
  });
});

describe('ConceptSheet: связи режима — правка → «грязный» лист → сохранение → отображение', () => {
  it('правка имени помечает лист грязным, сохранение шлёт modeLinks, ответ рисуется на карточке', async () => {
    await openSheet(concept());
    expect(
      screen.queryByRole('button', { name: 'Сохранить концептуализацию' }),
    ).toBeNull();

    fireEvent.click(card('Карающий Критик'));
    fireEvent.change(screen.getByLabelText('Как называет клиент'), {
      target: { value: 'Судья' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    const save = screen.getByRole('button', {
      name: 'Сохранить концептуализацию',
    });
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() =>
      expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1),
    );
    const [clientId, body] = mockApi.saveConceptualization.mock.calls[0];
    expect(clientId).toBe(7);
    expect(body.modeLinks).toEqual([
      {
        modeId: 'punitive_critic',
        alias: 'Судья',
        schemaIds: [],
        needIds: [],
        origin: '',
        manifest: '',
        strategy: '',
      },
    ]);
    expect(body.schemaIds).toEqual(['failure']);
    expect(body.modeIds).toEqual(['punitive_critic']);

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Сохранить концептуализацию' }),
      ).toBeNull(),
    );
    expect(within(card('Карающий Критик')).getByText('Судья')).toBeTruthy();
  });

  it('схема вне концептуализации из редактора связи добавляется и в schemaIds', async () => {
    await openSheet(concept());
    fireEvent.click(card('Карающий Критик'));
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: 'Все схемы' }));
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    const body = mockApi.saveConceptualization.mock.calls[0][1];
    expect(body.schemaIds).toEqual(['failure', 'abandonment']);
    expect(body.modeLinks[0].schemaIds).toEqual(['abandonment']);
  });

  it('связь режима, снятого с карты, остаётся в теле сохранения', async () => {
    await openSheet(
      concept({
        modeLinks: [
          {
            modeId: 'punitive_critic',
            alias: 'Судья',
            schemaIds: [],
            needIds: [],
            origin: '',
            manifest: '',
            strategy: '',
          },
        ],
      }),
    );
    fireEvent.click(card('Карающий Критик'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать режим с карты' }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    const body = mockApi.saveConceptualization.mock.calls[0][1];
    expect(body.modeIds).toEqual([]);
    expect(body.modeLinks.map((l: { alias: string }) => l.alias)).toEqual([
      'Судья',
    ]);
  });

  it('легаси-ответ без modeLinks не роняет лист, сохранение шлёт modeLinks: []', async () => {
    const legacy = concept();
    delete (legacy as Partial<typeof legacy>).modeLinks;
    await openSheet(legacy);
    expect(
      within(card('Карающий Критик')).getByText('связи не заполнены'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    expect(mockApi.saveConceptualization.mock.calls[0][1].modeLinks).toEqual(
      [],
    );
  });

  // Лист рисуется после асинхронной загрузки — вне act(), поэтому эффект
  // графа (он и шлёт событие) может отработать позже, чем findByText увидит
  // заголовок: на холодном раннере проверка «сразу» ловила []. Ждём событие,
  // а не момент отрисовки.
  it('открытие схемы шлёт concept_graph_open', async () => {
    await openSheet(concept());
    await waitFor(() =>
      expect(mockApi.trackEvent.mock.calls.map((c) => c[0])).toEqual([
        'concept_graph_open',
      ]),
    );
  });
});

describe('ConceptSheet: тексты схем — правка → «грязный» лист → сохранение → отображение', () => {
  const schemaButton = () =>
    screen.getByRole('button', {
      name: 'Схема Неуспешность: убеждение и опыт',
    });

  it('убеждение, опыт и потребность схемы уходят в schemaLinks кнопкой «Сохранить», ответ сервера рисуется на схеме', async () => {
    await openSheet(concept());
    expect(
      screen.queryByRole('button', { name: 'Сохранить концептуализацию' }),
    ).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    await waitFor(() =>
      expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1),
    );
    expect(mockApi.saveConceptualization.mock.calls[0][1].schemaLinks).toEqual([
      {
        schemaId: 'failure',
        belief: 'Я не справлюсь',
        origin: 'Критика за каждую ошибку',
        needIds: ['autonomy'],
      },
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Сохранить концептуализацию' }),
      ).toBeNull(),
    );
    expect(within(schemaButton()).getByText('Я не справлюсь')).toBeTruthy();
    expect(document.querySelectorAll('[data-badge="block"]')).toHaveLength(1);
  });

  it('«+ схема» добавляет схему в schemaIds тела сохранения', async () => {
    await openSheet(concept());
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Схемы' })).getByRole('button', {
        name: '+ схема',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Покинутость/ }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    expect(mockApi.saveConceptualization.mock.calls[0][1].schemaIds).toEqual([
      'failure',
      'abandonment',
    ]);
  });

  it('легаси-ответ без schemaLinks не роняет лист, сохранение шлёт schemaLinks: []', async () => {
    const legacy = concept();
    delete (legacy as Partial<typeof legacy>).schemaLinks;
    await openSheet(legacy);
    expect(within(schemaButton()).getByText('связи не заполнены')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Сохранить концептуализацию' }),
      );
    });
    expect(mockApi.saveConceptualization.mock.calls[0][1].schemaLinks).toEqual(
      [],
    );
  });

  it('событие concept_schema_linked шлётся один раз на схему', async () => {
    await openSheet(concept());
    fireEvent.click(schemaButton());
    const belief = () => screen.getByLabelText('Во что человек верит');
    fireEvent.change(belief(), { target: { value: 'я' } });
    fireEvent.change(belief(), { target: { value: 'я не' } });
    await waitFor(() =>
      expect(
        mockApi.trackEvent.mock.calls
          .map((c) => c[0])
          .filter((n) => n === 'concept_schema_linked'),
      ).toHaveLength(1),
    );
  });
});
