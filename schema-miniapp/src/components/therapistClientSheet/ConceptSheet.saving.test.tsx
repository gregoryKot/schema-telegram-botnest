// @vitest-environment jsdom
// ConceptSheet — часть 2/2 (правило №10 — файл ≤300 строк): сохранение
// концептуализации + экспорт. Остальное (закрытие/история/YSQ/схемы/режимы/
// поля) — в ConceptSheet.test.tsx. ConceptHistoryPanel/ConceptYsqHistory
// покрыты своими тестами — мокаем.
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

describe('ConceptSheet — сохранение', () => {
  it('нет правок (conceptDirty=false, нет concept) — кнопка disabled с «Нет изменений»', () => {
    render(
      <ConceptSheet selectedClient={makeClient()} detail={makeDetail()} />,
    );
    const btn = screen.getByText('Нет изменений');
    expect(btn.disabled).toBe(true);
  });

  it('уже сохранено ранее (concept есть, не dirty) — показывает дату сохранения', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          concept: {
            updatedAt: '2026-08-01T00:00:00.000Z',
          } as unknown as ClientDetail['concept'],
        })}
      />,
    );
    expect(screen.getByText(/✓ Сохранено/)).toBeTruthy();
  });

  it('conceptDirty=true — кнопка активна, клик зовёт saveConcept', () => {
    const saveConcept = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ conceptDirty: true, saveConcept })}
      />,
    );
    const btn = screen.getByText('Сохранить концептуализацию');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(saveConcept).toHaveBeenCalled();
  });

  it('conceptSaving=true — кнопка показывает «Сохраняю...» и disabled', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ conceptDirty: true, conceptSaving: true })}
      />,
    );
    const btn = screen.getByText('Сохраняю...');
    expect(btn.disabled).toBe(true);
  });

  it('conceptError задан — текст ошибки виден', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({ conceptError: 'Не удалось сохранить' })}
      />,
    );
    expect(screen.getByText('Не удалось сохранить')).toBeTruthy();
  });
});

describe('ConceptSheet — экспорт', () => {
  it('нет concept — кнопки экспорта нет', () => {
    render(
      <ConceptSheet selectedClient={makeClient()} detail={makeDetail()} />,
    );
    expect(screen.queryByText(/Экспорт/)).toBeNull();
  });

  it('concept есть — клик по экспорту зовёт handleExport', () => {
    const handleExport = vi.fn();
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          concept: {
            updatedAt: '2026-08-01T00:00:00.000Z',
          } as unknown as ClientDetail['concept'],
          handleExport,
        })}
      />,
    );
    fireEvent.click(screen.getByText('↗ Экспорт / Поделиться'));
    expect(handleExport).toHaveBeenCalled();
  });

  it('exportCopied=true — подпись меняется на «✓ Скопировано»', () => {
    render(
      <ConceptSheet
        selectedClient={makeClient()}
        detail={makeDetail({
          concept: {
            updatedAt: '2026-08-01T00:00:00.000Z',
          } as unknown as ClientDetail['concept'],
          exportCopied: true,
        })}
      />,
    );
    expect(screen.getByText('✓ Скопировано')).toBeTruthy();
  });
});
