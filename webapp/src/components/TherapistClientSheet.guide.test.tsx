// @vitest-environment jsdom
// Подсказки терапевту (#995) в карточке клиента: «Схема» → фигура режима или
// схемы → плашка «Обычно в методе» → листы режима, схемы и техники и «Дать
// заданием», которое открывает тот же лист «Новое задание», что «Назначить из
// шаблона». Лист из листа стоит не ниже родителя: тот же слой, позже в DOM.
// Разделы — фикстура, не тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistClientSheet } from './TherapistClientSheet';
import { CONCEPT_SHEET_Z } from './therapist/ConceptFullscreenSheet';
import {
  CONCEPT_GUIDE_ASSIGN_EVENT,
  CONCEPT_GUIDE_MODE_OPEN_EVENT,
  CONCEPT_GUIDE_SCHEMA_OPEN_EVENT,
  CONCEPT_GUIDE_TECHNIQUE_OPEN_EVENT,
} from '../../../shared/src/share/analytics';

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
    'getTherapyClients', 'getTherapyInvites', 'getTherapyTasksForClient', 'getTherapistNotes',
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
const zOf = (el: Element) => (el.closest('.sk-sheet, [role="dialog"]') as HTMLElement).style.zIndex;
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
