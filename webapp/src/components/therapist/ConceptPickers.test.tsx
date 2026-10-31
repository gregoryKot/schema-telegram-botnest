// @vitest-environment jsdom
// Карточка «Карта режимов» вида «Поля»: под чипами режимов читаются схемы,
// привязанные к ним в виде «Схема» (issue #879). Ссылка «привязать» зовёт
// переключение вида, которое вкладка прокидывает через onGoToGraph.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ConceptPickers } from './concept/ConceptPickers';
import type { ClientDetail } from './clientSheetTypes';

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
