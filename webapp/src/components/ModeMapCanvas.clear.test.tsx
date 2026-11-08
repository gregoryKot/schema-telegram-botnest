// @vitest-environment jsdom
// «Очистить карту» (просьба владельца «кнопка стереть всё») и «Выделить всё» —
// в «⋯ Ещё» тулбара и в меню правого клика по фону. Проверяем результат: что
// осталось в модели, что ушло в сохранение и что «Отменить» возвращает всё.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderCanvas, mmNode, mmEdge, readModel, getConceptualization, scheduleSaveMock } from './ModeMapCanvas.test-helpers';
import { installFlowTestPolyfills, clickToolbarButton } from '../test-support/renderWithFlow';

// Диалогу нужна запись в истории (HistoryConfirmDialog → useHistorySheet), а
// она требует Router: здесь goBack просто закрывает диалог и зовёт then.
vi.mock('../hooks/useHistorySheet', () => ({
  useHistorySheet: (onClose: () => void) => (then?: unknown) => { onClose(); if (typeof then === 'function') then(); },
}));

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  getConceptualization.mockReset();
  getConceptualization.mockResolvedValue(null);
  scheduleSaveMock.mockClear();
});
afterEach(() => cleanup());

const map = () => ({
  initialNodes: [mmNode('a', 'trigger', { label: 'Триггер' }), mmNode('b', 'behavior', { label: 'Поведение' })],
  initialEdges: [mmEdge('e1', 'a', 'b')],
});
const openClear = (container: HTMLElement) => {
  clickToolbarButton(container, 'Ещё');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Очистить карту…' }));
};

describe('ModeMapCanvas — «Очистить карту…» в «⋯ Ещё»', () => {
  it('спрашивает подтверждение и ничего не трогает до ответа', () => {
    const { container } = renderCanvas(map());
    openClear(container);
    expect(screen.getByRole('dialog', { name: 'Очистить карту?' })).toBeTruthy();
    expect(screen.getByText(/Концептуализация клиента не изменится/)).toBeTruthy();
    expect(readModel(container).nodes).toHaveLength(2);
  });

  it('«Очистить» убирает все фигуры и линии и сохраняет пустую карту', () => {
    const { container } = renderCanvas(map());
    openClear(container);
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(readModel(container)).toEqual({ nodes: [], edges: [] });
    expect(scheduleSaveMock).toHaveBeenLastCalledWith([], []);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Отмена» закрывает диалог и оставляет карту как была', () => {
    const { container } = renderCanvas(map());
    openClear(container);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readModel(container).nodes.map(n => n.id)).toEqual(['a', 'b']);
    expect(readModel(container).edges.map(e => e.id)).toEqual(['e1']);
    expect(scheduleSaveMock).not.toHaveBeenCalled();
  });

  it('после очистки «Отменить» возвращает фигуры и линии', () => {
    const { container } = renderCanvas(map());
    openClear(container);
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    clickToolbarButton(container, 'Отменить (⌘Z)');
    expect(readModel(container).nodes.map(n => n.id)).toEqual(['a', 'b']);
    expect(readModel(container).edges.map(e => e.id)).toEqual(['e1']);
  });

  it('очистка снимает выбор фигуры (панель свойств закрывается)', () => {
    const { container } = renderCanvas(map());
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    expect(container.querySelector('[data-testid="mm-debug-selected"]')!.textContent).toBe('a');
    openClear(container);
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(container.querySelector('[data-testid="mm-debug-selected"]')!.textContent).toBe('');
  });

  it('на пустой карте пункты «Очистить карту…» и «Выделить всё» отключены', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Ещё');
    expect((screen.getByRole('menuitem', { name: 'Очистить карту…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('menuitem', { name: 'Выделить всё' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ModeMapCanvas — «Выделить всё»', () => {
  const selectedCount = (c: HTMLElement) => c.querySelectorAll('.react-flow__node.selected').length;

  it('пункт в «⋯ Ещё» выделяет все фигуры', () => {
    const { container } = renderCanvas(map());
    expect(selectedCount(container)).toBe(0);
    clickToolbarButton(container, 'Ещё');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Выделить всё' }));
    expect(selectedCount(container)).toBe(2);
  });

  it('меню фона: «Выделить всё» и «Очистить карту…» с подтверждением', () => {
    const { container } = renderCanvas(map());
    fireEvent.contextMenu(container.querySelector('.react-flow__pane')!);
    fireEvent.click(screen.getByText('Выделить всё'));
    expect(selectedCount(container)).toBe(2);
    fireEvent.contextMenu(container.querySelector('.react-flow__pane')!);
    fireEvent.click(screen.getByText('Очистить карту…'));
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(readModel(container)).toEqual({ nodes: [], edges: [] });
  });

  it('меню фона пустой карты не предлагает очистку и выделение', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    fireEvent.contextMenu(container.querySelector('.react-flow__pane')!);
    expect(screen.getByText('Авто-расположение')).toBeTruthy();
    expect(screen.queryByText('Очистить карту…')).toBeNull();
    expect(screen.queryByText('Выделить всё')).toBeNull();
  });
});
