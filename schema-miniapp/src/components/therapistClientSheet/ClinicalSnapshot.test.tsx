// @vitest-environment jsdom
// ClinicalSnapshot — сводка концептуализации клиента у терапевта (0%
// покрытия). Пустое состояние честное (правило CLAUDE.md против хардкод-
// заглушек: «Концептуализация не заполнена», а не нули/пустой блок).
// concept (сервер) должен побеждать localConcept (черновик) там, где оба
// заданы — иначе после сохранения на экране всё ещё виден старый черновик.
// Длинные тексты обрезаются с «...» — регрессия здесь раньше рвала верстку.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClinicalSnapshot } from './ClinicalSnapshot';
import type { ClientDetail } from './types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    activeSchemaIds: [],
    activeModeIds: [],
    concept: null,
    localConcept: {},
    setShowConceptSheet: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

// concept с сервера — только поля, которые реально читает компонент
// (goals/modeTransitions); остальные обязательные поля ClientConceptualization
// компоненту не нужны.
function makeConcept(fields: {
  goals?: string | null;
  modeTransitions?: string | null;
}): ClientDetail['concept'] {
  return fields as unknown as ClientDetail['concept'];
}

describe('ClinicalSnapshot — пустое состояние', () => {
  it('ничего не заполнено — честное «Концептуализация не заполнена», не нули', () => {
    render(<ClinicalSnapshot detail={makeDetail()} />);
    expect(screen.getByText('Концептуализация не заполнена')).toBeTruthy();
    expect(screen.getByText('Заполнить концептуализацию')).toBeTruthy();
  });

  it('клик по кнопке пустого состояния зовёт setShowConceptSheet(true)', () => {
    const setShowConceptSheet = vi.fn();
    render(<ClinicalSnapshot detail={makeDetail({ setShowConceptSheet })} />);
    fireEvent.click(screen.getByText('Заполнить концептуализацию'));
    expect(setShowConceptSheet).toHaveBeenCalledWith(true);
  });
});

describe('ClinicalSnapshot — схемы', () => {
  it('activeSchemaIds заданы — показывает счётчик и карточки схем', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({ activeSchemaIds: ['emotional_deprivation'] })}
      />,
    );
    expect(screen.getByText('Схемы (1)')).toBeTruthy();
    expect(screen.getByText(/Эмоциональная депривация/)).toBeTruthy();
  });

  it('неизвестный id схемы — молча пропускается, не падает', () => {
    const { container } = render(
      <ClinicalSnapshot
        detail={makeDetail({ activeSchemaIds: ['nonexistent'] })}
      />,
    );
    expect(container.textContent).not.toBe('');
    expect(screen.getByText('Схемы (1)')).toBeTruthy();
  });
});

describe('ClinicalSnapshot — карта режимов', () => {
  it('activeModeIds заданы — группирует по MODE_GROUPS и показывает режим', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({ activeModeIds: ['vulnerable_child'] })}
      />,
    );
    expect(screen.getByText('Карта режимов')).toBeTruthy();
    expect(screen.getByText(/Уязвимый Ребёнок/)).toBeTruthy();
  });

  it('группа без активных режимов не рендерится вовсе', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({ activeModeIds: ['vulnerable_child'] })}
      />,
    );
    // Только одна подпись группы («Детские режимы» → «режимы») должна
    // появиться — остальные группы (копинги, здоровый взрослый) отсутствуют.
    expect(screen.queryByText('копинги')).toBeNull();
  });
});

describe('ClinicalSnapshot — цель терапии и переходы режимов', () => {
  it('concept.goals побеждает localConcept.goals, когда оба заданы', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: makeConcept({
            goals: 'Цель с сервера',
            modeTransitions: null,
          }),
          localConcept: { goals: 'Черновик локально' },
        })}
      />,
    );
    expect(screen.getByText('Цель с сервера')).toBeTruthy();
    expect(screen.queryByText('Черновик локально')).toBeNull();
  });

  it('нет concept с сервера — используется localConcept (черновик до сохранения)', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: null,
          localConcept: { goals: 'Черновик локально' },
        })}
      />,
    );
    expect(screen.getByText('Черновик локально')).toBeTruthy();
  });

  it('длинный текст цели обрезается до 160 символов с «...»', () => {
    const long = 'а'.repeat(200);
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: makeConcept({ goals: long, modeTransitions: null }),
        })}
      />,
    );
    expect(screen.getByText(`${'а'.repeat(160)}...`)).toBeTruthy();
  });

  it('короткий текст цели не обрезается и без «...»', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: makeConcept({ goals: 'Коротко', modeTransitions: null }),
        })}
      />,
    );
    expect(screen.getByText('Коротко')).toBeTruthy();
  });

  it('modeTransitions показывается отдельным блоком', () => {
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: makeConcept({
            goals: null,
            modeTransitions: 'От Критика к Здоровому взрослому',
          }),
        })}
      />,
    );
    expect(screen.getByText('Переходы режимов')).toBeTruthy();
    expect(screen.getByText('От Критика к Здоровому взрослому')).toBeTruthy();
  });
});

describe('ClinicalSnapshot — ссылка редактирования', () => {
  it('есть хоть что-то заполненное — кнопка «Редактировать концептуализацию →» зовёт setShowConceptSheet', () => {
    const setShowConceptSheet = vi.fn();
    render(
      <ClinicalSnapshot
        detail={makeDetail({
          concept: makeConcept({ goals: 'Цель', modeTransitions: null }),
          setShowConceptSheet,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Редактировать концептуализацию →'));
    expect(setShowConceptSheet).toHaveBeenCalledWith(true);
  });
});
