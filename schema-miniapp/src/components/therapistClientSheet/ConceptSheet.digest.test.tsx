// @vitest-environment jsdom
// Сводка «Коротко» в листе концептуализации мини-аппа (#902): над переключателем
// «Схема · Поля» при заполненной концептуализации (черновик сильнее сервера),
// при пустой её нет. История и YSQ-панели покрыты своими тестами — мокаем;
// сеть — тоже (схема шлёт событие открытия).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
vi.mock('./conceptSheet/ConceptHistoryPanel', () => ({
  ConceptHistoryPanel: () => null,
}));
vi.mock('./conceptSheet/ConceptYsqHistory', () => ({
  ConceptYsqHistory: () => null,
}));
import { ConceptSheet } from './ConceptSheet';
import type { ClientDetail } from './types';
import type { TherapyClientSummary } from '../../api';

afterEach(() => cleanup());

const CLIENT = {
  telegramId: 1,
  name: 'Клиент',
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
} as unknown as TherapyClientSummary;

const CONCEPT = {
  schemaIds: ['failure'],
  modeIds: ['punitive_critic', 'healthy_adult'],
  modeLinks: [
    {
      modeId: 'punitive_critic',
      alias: 'Судья',
      schemaIds: ['failure'],
      needIds: [],
      origin: '',
      manifest: '',
      strategy: '',
    },
  ],
  schemaLinks: [
    { schemaId: 'failure', belief: '', origin: '', needIds: ['autonomy'] },
  ],
  goals: 'Снизить тревогу',
  modeTransitions: 'Критика → Судья',
  history: [],
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    concept: null,
    localConcept: {},
    conceptDirty: false,
    conceptSaving: false,
    conceptError: '',
    showHistory: false,
    setShowHistory: vi.fn(),
    setShowConceptSheet: vi.fn(),
    ysqRequested: false,
    ysqError: '',
    exportCopied: false,
    activeSchemaIds: [],
    ysqSchemaIds: [],
    selfSchemaIds: [],
    activeModeIds: [],
    patchConcept: vi.fn(),
    toggleSchemaId: vi.fn(),
    toggleModeId: vi.fn(),
    saveConcept: vi.fn().mockResolvedValue(undefined),
    handleRequestYsq: vi.fn(),
    handleExport: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

const digest = () => screen.queryByRole('region', { name: 'Коротко' });

describe('ConceptSheet — сводка «Коротко»', () => {
  it('заполненная концептуализация — сводка над переключателем вида, черновик сильнее сервера', () => {
    render(
      <ConceptSheet
        selectedClient={CLIENT}
        detail={makeDetail({
          concept: CONCEPT as unknown as ClientDetail['concept'],
          localConcept: { goals: 'Вернуть злость' },
          activeSchemaIds: CONCEPT.schemaIds,
          activeModeIds: CONCEPT.modeIds,
        })}
      />,
    );
    const card = digest()!;
    expect(card).toBeTruthy();
    const value = (label: string) =>
      within(card).getByText(label).nextElementSibling?.textContent;
    expect(value('Схемы')).toBe('Неуспешность');
    expect(value('Режимы')).toBe('Судья (Карающий Критик) → Здоровый Взрослый');
    expect(value('Цикл')).toBe('Критика → Судья');
    expect(value('Потребности')).toBe('✗ блокированы: Автономия');
    expect(value('Цель')).toBe('Вернуть злость');
    const switcher = screen.getByRole('group', {
      name: 'Вид концептуализации',
    });
    expect(
      card.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('пустая концептуализация — сводки нет', () => {
    render(<ConceptSheet selectedClient={CLIENT} detail={makeDetail()} />);
    expect(digest()).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Вид концептуализации' }),
    ).toBeTruthy();
  });
});
