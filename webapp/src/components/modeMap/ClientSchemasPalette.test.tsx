// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClientSchemasPalette } from './ClientSchemasPalette';
import { ModeMapConceptContext, type ClientConceptState } from './clientConceptContext';

afterEach(() => cleanup());

function renderSection(state: ClientConceptState) {
  const onAdd = vi.fn();
  const onDragStart = vi.fn();
  const view = render(
    <ModeMapConceptContext.Provider value={state}>
      <ClientSchemasPalette onAdd={onAdd} onDragStart={onDragStart} />
    </ModeMapConceptContext.Provider>,
  );
  return { onAdd, onDragStart, ...view };
}

describe('ClientSchemasPalette — раздел «Схемы клиента»', () => {
  it('показывает схемы клиента; клик добавляет узел schema с schemaId и названием', () => {
    const { onAdd } = renderSection({ schemaIds: ['abandonment', 'mistrust'], modeIds: [], modeLinks: [] });
    expect(screen.getByText('Недоверие / Ожидание жестокого обращения')).toBeTruthy();
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'schema',
      data: expect.objectContaining({ schemaId: 'abandonment', label: 'Покинутость / Нестабильность' }),
    }));
  });

  it('неизвестный id схемы пропускается', () => {
    renderSection({ schemaIds: ['no_such_schema'], modeIds: [], modeLinks: [] });
    expect(screen.getByText('У клиента пока нет отмеченных схем')).toBeTruthy();
  });

  it('пустой список — «У клиента пока нет отмеченных схем»', () => {
    renderSection({ schemaIds: [], modeIds: [], modeLinks: [] });
    expect(screen.getByText('У клиента пока нет отмеченных схем')).toBeTruthy();
  });

  it('сбой загрузки — «Не удалось загрузить», а не «схем нет»', () => {
    renderSection('failed');
    expect(screen.getByText('Не удалось загрузить схемы клиента')).toBeTruthy();
    expect(screen.queryByText('У клиента пока нет отмеченных схем')).toBeNull();
  });

  it('пока грузится или клиента нет — раздела нет', () => {
    const { container } = renderSection(null);
    expect(container.textContent).toBe('');
  });
});
