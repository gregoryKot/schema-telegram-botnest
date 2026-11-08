// @vitest-environment jsdom
// Подсказки терапевту (#995) в карточке клиента: «Схема» → фигура режима или
// схемы → плашка «Обычно в методе» → листы режима, схемы и техники и «Дать
// заданием», которое открывает тот же лист «Новое задание», что «Назначить из
// шаблона». Лист из листа стоит не ниже родителя: тот же слой, позже в DOM.
// Разделы — фикстура, не тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistClientSheet } from './TherapistClientSheet';
import { CONCEPT_SHEET_Z } from './therapist/ConceptFullscreenSheet';
import {
  CONCEPT_GUIDE_ASSIGN_EVENT,
  CONCEPT_GUIDE_JOURNAL_ENTRY_EVENT,
  CONCEPT_GUIDE_JOURNAL_OPEN_EVENT,
  CONCEPT_GUIDE_MARK_DONE_EVENT,
  CONCEPT_GUIDE_MODE_OPEN_EVENT,
  CONCEPT_GUIDE_SCHEMA_OPEN_EVENT,
  CONCEPT_GUIDE_TECHNIQUE_OPEN_EVENT,
} from '../../../shared/src/share/analytics';
import { JOURNAL_LINK_LABEL } from '../../../shared/src/therapy/conceptGraph/JournalLink';

vi.mock('../../../shared/src/schemaTherapy/guide', async () => {
  const f = await import('../../../shared/src/therapy/conceptGraph/conceptGuide.fixture');
  return {
    modeGuide: (_tr: unknown, id: string) => (id === 'vulnerable_child' ? f.FIXTURE_GUIDE : null),
    schemaGuide: (_tr: unknown, id: string) =>
      id === 'abandonment' ? { guide: f.FIXTURE_SCHEMA_GUIDE, domainNote: f.FIXTURE_DOMAIN_NOTE } : null,
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
    techniqueGuide: (_tr: unknown, id: string) => f.FIXTURE_TECHNIQUES.find((t) => t.id === id) ?? null,
  };
});
vi.mock('../api', () => ({
  api: Object.fromEntries([
    'getTherapyClients', 'getTherapyInvites', 'getCardClaims', 'getTherapyTasksForClient', 'getTherapistNotes',
    'getConceptualization', 'getTherapyClientData', 'getClientSchemaNotes', 'getClientModeNotes',
    'getTherapyClientHistory', 'getClientDiary', 'saveConceptualization', 'createTask', 'trackEvent',
  ].map((k) => [k, vi.fn()])),
  reportClientError: vi.fn(),
}));
import { api } from '../api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyClients.mockResolvedValue([{
    telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
    recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
    nextSession: null, meetingDays: [], schemaIds: [],
  }]);
  mockApi.getTherapyInvites.mockResolvedValue([]);
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue({
    id: 1, therapistId: 1, clientId: 7, schemaIds: ['abandonment'], modeIds: ['vulnerable_child'],
    earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null, goals: null,
    currentProblems: null, modeTransitions: null, modeLinks: [], schemaLinks: [],
    modeMapNodes: [], modeMapEdges: [], history: [], updatedAt: '2026-10-01T00:00:00.000Z',
  });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
});
afterEach(() => cleanup());

function Wrapper() {
  const [view, setView] = useState<'list' | 'client'>('list');
  return <TherapistClientSheet view={view} onViewChange={setView} onClose={vi.fn()} />;
}

async function openPlaque(figure = 'Уязвимый Ребёнок: связи') {
  render(<MemoryRouter><Wrapper /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Анна'));
  await screen.findByText('Обзор');
  fireEvent.click(screen.getByText('Концептуализация'));
  fireEvent.click(await screen.findByRole('button', { name: figure }));
  await screen.findByText('Обычно в методе');
}
const SCHEMA = 'Покинутость / Нестабильность';
const openSchemaPlaque = () => openPlaque(`Схема ${SCHEMA}: убеждение и опыт`);
const tracked = (name: string) => mockApi.trackEvent.mock.calls.filter((c) => c[0] === name).length;
// z-index листа: у листа-панели подсказок (ConceptFullscreenSheet `panel`) он на слое .cfs-layer вокруг диалога.
const zOf = (el: Element) => {
  const sheet = el.closest('.sk-sheet, [role="dialog"]')!;
  return ((sheet.closest('.cfs-layer') ?? sheet) as HTMLElement).style.zIndex;
};
const isAfter = (a: Element, b: Element) => (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('TherapistClientSheet — подсказки терапевту', () => {
  it('«Дать заданием» у упражнения без экрана открывает «Своё задание» с названием и инструкцией', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Дать заданием: Встреча со своим маленьким Я' }));
    await screen.findByText('Задание · Анна');
    const custom = screen.getByText('Своё задание').closest('[aria-pressed]')!;
    expect(custom.getAttribute('aria-pressed')).toBe('true');
    const text = document.querySelector<HTMLTextAreaElement>('.sk-sheet textarea')!;
    expect(text.value).toBe('Встреча со своим маленьким Я\nПять минут в день побыть рядом с детским образом');
    // литерал в api.trackEvent (трипваер analytics-sync) совпадает с константой shared
    expect(tracked(CONCEPT_GUIDE_ASSIGN_EVENT)).toBe(1);
  });

  it('«Подробнее» → лист режима, техника → лист техники поверх, «Закрыть» возвращает к режиму', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    const mode = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    expect(tracked(CONCEPT_GUIDE_MODE_OPEN_EVENT)).toBe(1);
    fireEvent.click(within(mode).getByRole('button', { name: 'Рескриптинг образов' }));
    const technique = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(tracked(CONCEPT_GUIDE_TECHNIQUE_OPEN_EVENT)).toBe(1);
    // тот же слой и позже в DOM — лист техники лежит над листом режима
    expect(zOf(technique)).toBe(zOf(mode));
    expect(isAfter(technique, mode)).toBe(true);
    fireEvent.click(within(technique).getByRole('button', { name: 'Закрыть' }));
    expect(await screen.findByRole('dialog', { name: 'Уязвимый Ребёнок' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Рескриптинг образов' })).toBeNull();
  });

  it('«Дать заданием» из листа режима: «Новое задание» с типом упражнения встаёт над листом', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    const mode = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    fireEvent.click(within(mode).getByRole('button', { name: 'Дать заданием: Письмо себе' }));
    await screen.findByText('Задание · Анна');
    // тип в «Новом задании» — имя из каталога упражнений (#984), а не пункт раздела режима
    const letter = screen.getAllByText('Письмо себе в детстве').map((n) => n.closest('[aria-pressed]')).find(Boolean)!;
    expect(letter.getAttribute('aria-pressed')).toBe('true');
    const sheet = letter.closest('.sk-sheet')!;
    // без подъёма .sk-sheet (z 90) лёг бы под лист режима: кнопка «не работает»
    expect(zOf(sheet)).toBe(String(CONCEPT_SHEET_Z));
    expect(zOf(mode)).toBe(String(CONCEPT_SHEET_Z));
    expect(isAfter(sheet, mode)).toBe(true);
  });

  it('схема: «Подробнее о схеме» → лист схемы, техника из него — поверх, «Закрыть» возвращает к схеме', async () => {
    await openSchemaPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о схеме' }));
    const schema = screen.getByRole('dialog', { name: SCHEMA });
    expect(tracked(CONCEPT_GUIDE_SCHEMA_OPEN_EVENT)).toBe(1);
    expect(tracked(CONCEPT_GUIDE_MODE_OPEN_EVENT)).toBe(0);
    fireEvent.click(within(schema).getByRole('button', { name: 'Работа со стульями' }));
    const technique = screen.getByRole('dialog', { name: 'Работа со стульями' });
    expect(tracked(CONCEPT_GUIDE_TECHNIQUE_OPEN_EVENT)).toBe(1);
    expect(zOf(technique)).toBe(zOf(schema));
    expect(isAfter(technique, schema)).toBe(true);
    fireEvent.click(within(technique).getByRole('button', { name: 'Закрыть' }));
    expect(await screen.findByRole('dialog', { name: SCHEMA })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Работа со стульями' })).toBeNull();
  });

  it('схема: «Дать заданием» с плашки открывает «Своё задание» с текстом пункта', async () => {
    await openSchemaPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Дать заданием: Дневник разлук' }));
    await screen.findByText('Задание · Анна');
    const text = document.querySelector<HTMLTextAreaElement>('.sk-sheet textarea')!;
    expect(text.value).toBe('Дневник разлук\nЗаписывать, что происходит, когда близкий долго не отвечает');
    expect(tracked(CONCEPT_GUIDE_ASSIGN_EVENT)).toBe(1);
  });

  it('схема: «Дать заданием» из листа схемы — «Новое задание» с типом упражнения над листом', async () => {
    await openSchemaPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о схеме' }));
    const schema = screen.getByRole('dialog', { name: SCHEMA });
    fireEvent.click(within(schema).getByRole('button', { name: 'Дать заданием: Карточка схемы' }));
    await screen.findByText('Задание · Анна');
    const card = screen.getAllByText('Карточка схемы').map((n) => n.closest('[aria-pressed]')).find(Boolean)!;
    expect(card.getAttribute('aria-pressed')).toBe('true');
    const sheet = card.closest('.sk-sheet')!;
    expect(zOf(sheet)).toBe(String(CONCEPT_SHEET_Z));
    expect(isAfter(sheet, schema)).toBe(true);
  });
});

// История (#995): «давали …» — из заданий клиента, которые карточка уже грузит;
// «Делали сегодня» в листе техники — правка связи режима, которая уходит
// автосохранением и после повторной загрузки видна как «делали …».
describe('TherapistClientSheet — история подсказок', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('задание клиента по пункту — «давали …» на плашке и в листе режима', async () => {
    mockApi.getTherapyTasksForClient.mockResolvedValue([{
      id: 1, userId: 7, assignedBy: 1, type: 'letter_to_self', text: 'Написать письмо себе в детстве',
      targetDays: null, needId: null, dueDate: null, done: true, completedAt: '2026-10-14T10:00:00.000Z',
      createdAt: '2026-10-12T10:00:00.000Z',
    }]);
    await openPlaque();
    expect(screen.getByText('давали 12 окт · выполнено')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    const mode = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    expect(within(mode).getByText('давали 12 окт · выполнено')).toBeTruthy();
  });

  it('«Делали сегодня» → связь режима с отметкой уходит в сохранение → после загрузки «делали 7 ноя»', async () => {
    mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => ({
      ...(await mockApi.getConceptualization()), ...body,
    }));
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Работа со стульями' }));
    const technique = screen.getByRole('dialog', { name: 'Работа со стульями' });
    fireEvent.click(within(technique).getByRole('button', { name: 'Делали сегодня' }));
    expect(tracked(CONCEPT_GUIDE_MARK_DONE_EVENT)).toBe(1);
    expect(within(technique).getByRole('button', { name: 'Отменить сегодняшнюю отметку' })).toBeTruthy();
    await waitFor(() => expect(mockApi.saveConceptualization).toHaveBeenCalled(), { timeout: 3000 });
    const body = mockApi.saveConceptualization.mock.calls.at(-1)![1];
    const done = [{ techniqueId: 'chairwork', day: '2026-11-07' }];
    expect(body.modeLinks).toEqual([expect.objectContaining({ modeId: 'vulnerable_child', done })]);

    // перезагрузка: карточка открывается заново и читает сохранённое с сервера
    cleanup();
    const saved = await mockApi.getConceptualization();
    mockApi.getConceptualization.mockResolvedValue({ ...saved, modeLinks: body.modeLinks });
    await openPlaque();
    expect(screen.getByText('· делали 7 ноя')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Работа со стульями' }));
    const again = screen.getByRole('dialog', { name: 'Работа со стульями' });
    expect(within(again).getByText('делали 7 ноя')).toBeTruthy();
    expect(within(again).getByRole('button', { name: 'Отменить сегодняшнюю отметку' })).toBeTruthy();
  });
});

// Журнал техник (#995): «журнал →» за «делали …» ведёт на «Задания» к блоку
// «На сессиях»; открытые листы до перехода закрываются (их записи истории
// сняты). Строка журнала открывает тот же лист техники с днём отметки.
describe('TherapistClientSheet — журнал техник', () => {
  const marked = { modeId: 'vulnerable_child', alias: '', schemaIds: [], needIds: [], origin: '', manifest: '', strategy: '',
    done: [{ techniqueId: 'chairwork', day: '2026-11-05' }] };
  const ROW = '5 ноя: Работа со стульями — Уязвимый Ребёнок';
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    const base = await mockApi.getConceptualization();
    mockApi.getConceptualization.mockResolvedValue({ ...base, modeLinks: [marked] });
  });
  afterEach(() => vi.useRealTimers());

  const journal = () => screen.findByRole('region', { name: 'На сессиях' });

  it('с плашки: «журнал →» — вкладка «Задания», в журнале строка отметки', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: JOURNAL_LINK_LABEL }));
    expect(tracked(CONCEPT_GUIDE_JOURNAL_OPEN_EVENT)).toBe(1);
    const block = await journal();
    expect(within(block).getByRole('button', { name: ROW })).toBeTruthy();
    expect(screen.queryByText('Обычно в методе')).toBeNull();
  });

  it('из листа техники поверх листа режима: оба листа закрываются, затем журнал', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    const mode = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    fireEvent.click(within(mode).getByRole('button', { name: 'Работа со стульями' }));
    const technique = screen.getByRole('dialog', { name: 'Работа со стульями' });
    fireEvent.click(within(technique).getByRole('button', { name: JOURNAL_LINK_LABEL }));
    await journal();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('из схемы «На весь экран»: лист схемы тоже закрывается', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: 'Ещё действия' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /На весь экран/ }));
    const full = await screen.findByRole('dialog', { name: 'Схема случая' });
    fireEvent.click(within(full).getByRole('button', { name: 'Уязвимый Ребёнок: связи' }));
    fireEvent.click(await within(full).findByRole('button', { name: JOURNAL_LINK_LABEL }));
    await journal();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('строка журнала → лист техники с днём строки; «Снять отметку» уходит в сохранение', async () => {
    await openPlaque();
    fireEvent.click(screen.getByRole('button', { name: JOURNAL_LINK_LABEL }));
    fireEvent.click(within(await journal()).getByRole('button', { name: ROW }));
    expect(tracked(CONCEPT_GUIDE_JOURNAL_ENTRY_EVENT)).toBe(1);
    const sheet = await screen.findByRole('dialog', { name: 'Работа со стульями' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Снять отметку за 5 ноя' }));
    expect(within(sheet).getByRole('button', { name: 'Вернуть отметку за 5 ноя' })).toBeTruthy();
    await waitFor(() => expect(mockApi.saveConceptualization).toHaveBeenCalled(), { timeout: 3000 });
    const body = mockApi.saveConceptualization.mock.calls.at(-1)![1];
    expect(body.modeLinks[0].done ?? []).toEqual([]);
  });
});
