// @vitest-environment jsdom
// Карточка «Карта режимов» вида «Поля»: под чипами режимов читаются схемы,
// привязанные к ним в виде «Схема» (issue #879). Ссылка «привязать» зовёт
// переключение вида, которое вкладка прокидывает через onGoToGraph.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ConceptPickers } from './concept/ConceptPickers';
import type { ClientDetail } from './clientSheetTypes';

afterEach(() => cleanup());

const LINK = {
  modeId: 'punitive_critic',
  alias: '',
  schemaIds: ['failure'],
  needIds: [],
  origin: '',
  manifest: '',
  strategy: '',
};

function detailWith(modeLinks: unknown, localLinks?: unknown): ClientDetail {
  return {
    activeSchemaIds: ['failure'],
    toggleSchemaId: vi.fn(),
    activeModeIds: ['punitive_critic'],
    toggleModeId: vi.fn(),
    localConcept: localLinks === undefined ? {} : { modeLinks: localLinks },
    concept: { modeLinks },
  } as unknown as ClientDetail;
}

// Имена схем есть и в чипах карточки «Актуальные схемы» — ищем внутри списка.
const list = () => within(screen.getByText('Схемы за режимами').parentElement!);

describe('ConceptPickers: схемы за режимами', () => {
  it('связи из концептуализации сервера → имена схем под чипами режимов', () => {
    render(<ConceptPickers detail={detailWith([LINK])} />);
    expect(list().getByText('Неуспешность')).toBeTruthy();
    expect(list().getByText('Карающий Критик')).toBeTruthy();
  });

  it('черновик localConcept сильнее ответа сервера', () => {
    render(
      <ConceptPickers
        detail={detailWith([LINK], [{ ...LINK, schemaIds: ['mistrust'] }])}
      />,
    );
    expect(list().getByText(/Недоверие/)).toBeTruthy();
    expect(list().queryByText('Неуспешность')).toBeNull();
  });

  it('связей нет → «схемы не привязаны», ссылка зовёт onGoToGraph', () => {
    const onGoToGraph = vi.fn();
    render(<ConceptPickers detail={detailWith([])} onGoToGraph={onGoToGraph} />);
    expect(screen.getByText('схемы не привязаны')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /привязать в виде «Схема»/ }));
    expect(onGoToGraph).toHaveBeenCalledTimes(1);
  });
});

// «Поля»: в спокойном состоянии — только выбранное; «Изменить» раскрывает весь
// перечень, «Готово» сворачивает обратно.
function selection(schemas: string[], modes: string[]): ClientDetail {
  return {
    activeSchemaIds: schemas,
    toggleSchemaId: vi.fn(),
    activeModeIds: modes,
    toggleModeId: vi.fn(),
    localConcept: {},
    concept: { modeLinks: [] },
  } as unknown as ClientDetail;
}
const SCHEMAS = ['failure', 'mistrust', 'emotional_deprivation', 'self_sacrifice'];
const MODES = ['punitive_critic', 'vulnerable_child', 'healthy_adult', 'detached_protector'];
const edit = (title: string) => screen.getByRole('button', { name: new RegExp(`Изменить: ${title}`) });

describe('ConceptPickers: только выбранное', () => {
  it('4 схемы и 4 режима выбраны — видны только они, невыбранных нет, чипы режимов — не кнопки', () => {
    render(<ConceptPickers detail={selection(SCHEMAS, MODES)} />);
    expect(screen.getByText('Неуспешность')).toBeTruthy();
    expect(screen.queryByText('Эмоциональная скованность')).toBeNull();
    expect(screen.getAllByText(/Карающий Критик/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Сердитый Ребёнок/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Карающий Критик/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Неуспешность' })).toBeNull();
    expect(edit('Актуальные схемы').getAttribute('aria-expanded')).toBe('false');
  });

  it('«Изменить» раскрывает все схемы, кнопка становится «Готово»; клик по чипу зовёт toggleSchemaId; «Готово» сворачивает', () => {
    const detail = selection(SCHEMAS, MODES);
    render(<ConceptPickers detail={detail} />);
    fireEvent.click(edit('Актуальные схемы'));
    expect(screen.getByRole('button', { name: /Готово: Актуальные схемы/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Эмоциональная скованность')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Эмоциональная скованность' }));
    expect(detail.toggleSchemaId).toHaveBeenCalledWith('emotional_inhibition');
    fireEvent.click(screen.getByRole('button', { name: /Готово: Актуальные схемы/ }));
    expect(screen.queryByText('Эмоциональная скованность')).toBeNull();
  });

  it('«Изменить» у режимов раскрывает все режимы; клик зовёт toggleModeId; «Схемы за режимами» остаются в обоих состояниях', () => {
    const detail = selection(SCHEMAS, MODES);
    render(<ConceptPickers detail={detail} />);
    expect(screen.getByText('Схемы за режимами')).toBeTruthy();
    expect(screen.queryByText(/Сердитый Ребёнок/)).toBeNull();
    fireEvent.click(edit('Карта режимов'));
    expect(screen.getByText('Схемы за режимами')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сердитый Ребёнок/ }));
    expect(detail.toggleModeId).toHaveBeenCalledWith('angry_child');
    expect(screen.getByRole('button', { name: /Готово: Карта режимов/ })).toBeTruthy();
  });

  it('ничего не выбрано — полный список виден сразу, кнопки «Изменить» нет', () => {
    render(<ConceptPickers detail={selection([], [])} />);
    expect(screen.getByRole('button', { name: 'Неуспешность' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Сердитый Ребёнок/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Изменить|Готово/ })).toBeNull();
  });

  it('первый выбор из пустого состояния не сворачивает выбор под пальцем', () => {
    const { rerender } = render(<ConceptPickers detail={selection([], [])} />);
    rerender(<ConceptPickers detail={selection(['failure'], [])} />);
    expect(screen.getByRole('button', { name: 'Эмоциональная скованность' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Готово: Актуальные схемы/ })).toBeTruthy();
  });
});
