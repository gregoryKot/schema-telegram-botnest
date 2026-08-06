// @vitest-environment jsdom
// ConceptSheet — часть 1/2 (правило №10 — файл ≤300 строк): закрытие с
// несохранёнными правками, история, YSQ, схемы, режимы, текстовые поля.
// Сохранение/экспорт — в ConceptSheet.saving.test.tsx. ConceptHistoryPanel/
// ConceptYsqHistory покрыты своими тестами — мокаем. Ключевое правило: закрытие
// с несохранённым черновиком (conceptDirty) само зовёт saveConcept — иначе
// правки молча теряются при случайном свайпе вниз.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConceptSheet } from './ConceptSheet';
import type { ClientDetail } from './types';
import type { TherapyClientSummary } from '../../api';

vi.mock('./conceptSheet/ConceptHistoryPanel', () => ({
  ConceptHistoryPanel: () => <div data-testid="history-panel" />,
}));
vi.mock('./conceptSheet/ConceptYsqHistory', () => ({
  ConceptYsqHistory: () => <div data-testid="ysq-history" />,
}));

afterEach(() => {
  cleanup();
});

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
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
    ...overrides,
  };
}

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

describe('ConceptSheet — закрытие с несохранёнными правками', () => {
  it('conceptDirty=true — Escape зовёт saveConcept ПЕРЕД закрытием', () => {
    const saveConcept = vi.fn().mockResolvedValue(undefined);
    const setShowConceptSheet = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          conceptDirty: true,
          saveConcept,
          setShowConceptSheet,
        })}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(saveConcept).toHaveBeenCalled();
    expect(setShowConceptSheet).toHaveBeenCalledWith(false);
  });

  it('conceptDirty=false — Escape закрывает БЕЗ вызова saveConcept', () => {
    const saveConcept = vi.fn();
    const setShowConceptSheet = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          conceptDirty: false,
          saveConcept,
          setShowConceptSheet,
        })}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(saveConcept).not.toHaveBeenCalled();
    expect(setShowConceptSheet).toHaveBeenCalledWith(false);
  });
});

describe('ConceptSheet — история концептуализации', () => {
  it('нет истории (concept=null) — кнопка «История» не рендерится', () => {
    render(
      <ConceptSheet selectedClient={makeClient()} detail={makeDetail()} />,
    );
    expect(screen.queryByText(/История/)).toBeNull();
  });

  it('есть история — кнопка с количеством, клик тогглит showHistory', () => {
    const setShowHistory = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          concept: {
            history: [{}, {}],
            updatedAt: '2026-08-01T00:00:00.000Z',
          } as unknown as ClientDetail['concept'],
          setShowHistory,
        })}
      />,
    );
    expect(screen.getByText('История (2)')).toBeTruthy();
    fireEvent.click(screen.getByText('История (2)'));
    expect(setShowHistory).toHaveBeenCalled();
  });
});

describe('ConceptSheet — запрос теста YSQ', () => {
  it('реальный клиент (telegramId>0) — кнопка запроса видна', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient({ telegramId: 5 })}
        detail={makeDetail()}
      />,
    );
    expect(screen.getByText('Запросить тест на схемы')).toBeTruthy();
  });

  it('тестовый клиент (telegramId<=0) — кнопки запроса нет', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient({ telegramId: -1 })}
        detail={makeDetail()}
      />,
    );
    expect(screen.queryByText(/Запросить тест/)).toBeNull();
  });

  it('клик по кнопке зовёт handleRequestYsq', () => {
    const handleRequestYsq = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ handleRequestYsq })}
      />,
    );
    fireEvent.click(screen.getByText('Запросить тест на схемы'));
    expect(handleRequestYsq).toHaveBeenCalled();
  });

  it('ysqRequested=true — подпись меняется на «✓ Запрос отправлен»', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ ysqRequested: true })}
      />,
    );
    expect(screen.getByText('✓ Запрос отправлен')).toBeTruthy();
  });

  it('ysqError задан — текст ошибки виден', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ ysqError: 'Запрос уже отправлен' })}
      />,
    );
    expect(screen.getByText('Запрос уже отправлен')).toBeTruthy();
  });
});

describe('ConceptSheet — схемы (самооценка клиента)', () => {
  it('selfSchemaIds заданы — показывает блок «Схемы клиента (самооценка)»', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ selfSchemaIds: ['emotional_deprivation'] })}
      />,
    );
    expect(screen.getByText('Схемы клиента (самооценка)')).toBeTruthy();
  });

  it('пусто — блока самооценки нет', () => {
    render(
      <ConceptSheet selectedClient={makeClient()} detail={makeDetail()} />,
    );
    expect(screen.queryByText('Схемы клиента (самооценка)')).toBeNull();
  });
});

describe('ConceptSheet — актуальные схемы (ЭДС)', () => {
  it('клик по схеме зовёт toggleSchemaId с её id', () => {
    const toggleSchemaId = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ toggleSchemaId })}
      />,
    );
    fireEvent.click(screen.getByText(/Эмоциональная депривация/));
    expect(toggleSchemaId).toHaveBeenCalledWith('emotional_deprivation');
  });
});

describe('ConceptSheet — карта режимов', () => {
  it('клик по режиму зовёт toggleModeId с его id', () => {
    const toggleModeId = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ toggleModeId })}
      />,
    );
    fireEvent.click(screen.getByText(/Уязвимый Ребёнок/));
    expect(toggleModeId).toHaveBeenCalledWith('vulnerable_child');
  });
});

describe('ConceptSheet — текстовые поля концептуализации', () => {
  it('ввод в поле зовёт patchConcept с ключом поля', () => {
    const patchConcept = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ patchConcept })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Что должно измениться/), {
      target: { value: 'Снизить тревогу' },
    });
    expect(patchConcept).toHaveBeenCalledWith({ goals: 'Снизить тревогу' });
  });
});
