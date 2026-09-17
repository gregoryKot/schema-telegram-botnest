// @vitest-environment jsdom
// ConceptHistoryPanel — история снимков концептуализации, с восстановлением
// (0% покрытия). Гейт видимости — тройное условие (showHistory && concept &&
// history.length>0); «Восстановить» пишет ВСЕ поля снимка разом (правило
// read-after-write: восстановленный снимок обязан полностью заменить черновик,
// частичное восстановление — источник «половина полей осталась старой»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConceptHistoryPanel } from './ConceptHistoryPanel';
import type { ClientDetail } from '../types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    concept: null,
    showHistory: false,
    setLocalConcept: vi.fn(),
    setConceptDirty: vi.fn(),
    setShowHistory: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

// Снимки истории — только поля, которые реально читает компонент; остальные
// обязательные поля ClientConceptualization/ConceptSnapshot тут не нужны.
function makeConcept(history: unknown[]): ClientDetail['concept'] {
  return { history } as unknown as ClientDetail['concept'];
}

describe('ConceptHistoryPanel — гейт видимости', () => {
  it('showHistory=false — ничего не рендерит, даже если история есть', () => {
    const { container } = render(
      <ConceptHistoryPanel
        detail={makeDetail({
          showHistory: false,
          concept: makeConcept([{ savedAt: '2026-08-01T00:00:00.000Z' }]),
        })}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('showHistory=true, но concept.history пуст — ничего не рендерит', () => {
    const { container } = render(
      <ConceptHistoryPanel
        detail={makeDetail({ showHistory: true, concept: makeConcept([]) })}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('showHistory=true, concept=null — ничего не рендерит', () => {
    const { container } = render(
      <ConceptHistoryPanel
        detail={makeDetail({ showHistory: true, concept: null })}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('ConceptHistoryPanel — снимок', () => {
  const snap = {
    savedAt: '2026-08-01T00:00:00.000Z',
    schemaIds: ['emotional_deprivation'],
    modeIds: ['vulnerable_child'],
    goals: 'Снизить тревогу',
    earlyExperience: null,
    unmetNeeds: null,
    triggers: null,
    copingStyles: null,
    modeTransitions: null,
    currentProblems: null,
  };

  it('показывает схемы, режимы и заполненные текстовые поля снимка', () => {
    render(
      <ConceptHistoryPanel
        detail={makeDetail({ showHistory: true, concept: makeConcept([snap]) })}
      />,
    );
    expect(screen.getByText(/Эмоциональная депривация/)).toBeTruthy();
    expect(screen.getByText(/Уязвимый Ребёнок/)).toBeTruthy();
    expect(screen.getByText(/Снизить тревогу/)).toBeTruthy();
  });

  it('пустые текстовые поля снимка не рисуются', () => {
    render(
      <ConceptHistoryPanel
        detail={makeDetail({ showHistory: true, concept: makeConcept([snap]) })}
      />,
    );
    expect(screen.queryByText(/Опыт:/)).toBeNull();
  });

  it('длинный текст поля обрезается до 140 символов с «...»', () => {
    const long = 'б'.repeat(200);
    render(
      <ConceptHistoryPanel
        detail={makeDetail({
          showHistory: true,
          concept: makeConcept([{ ...snap, goals: long }]),
        })}
      />,
    );
    expect(screen.getByText(`${'б'.repeat(140)}...`)).toBeTruthy();
  });

  it('клик «Восстановить» переносит ВСЕ поля снимка в localConcept, ставит dirty и закрывает историю', () => {
    const setLocalConcept = vi.fn();
    const setConceptDirty = vi.fn();
    const setShowHistory = vi.fn();
    render(
      <ConceptHistoryPanel
        detail={makeDetail({
          showHistory: true,
          concept: makeConcept([snap]),
          setLocalConcept,
          setConceptDirty,
          setShowHistory,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Восстановить'));
    expect(setLocalConcept).toHaveBeenCalledWith({
      schemaIds: ['emotional_deprivation'],
      modeIds: ['vulnerable_child'],
      earlyExperience: '',
      unmetNeeds: '',
      triggers: '',
      copingStyles: '',
      goals: 'Снизить тревогу',
      currentProblems: '',
      modeTransitions: '',
    });
    expect(setConceptDirty).toHaveBeenCalledWith(true);
    expect(setShowHistory).toHaveBeenCalledWith(false);
  });

  it('несколько снимков — все рендерятся, каждый со своей датой', () => {
    render(
      <ConceptHistoryPanel
        detail={makeDetail({
          showHistory: true,
          concept: makeConcept([
            snap,
            {
              ...snap,
              savedAt: '2026-07-01T00:00:00.000Z',
              goals: 'Старая цель',
            },
          ]),
        })}
      />,
    );
    expect(screen.getAllByText('Восстановить')).toHaveLength(2);
    expect(screen.getByText(/Старая цель/)).toBeTruthy();
  });
});
