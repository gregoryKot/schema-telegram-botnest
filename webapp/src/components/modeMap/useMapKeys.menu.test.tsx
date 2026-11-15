// @vitest-environment jsdom
// Escape при открытом меню тулбара холста (общий Dropdown) закрывает только меню: выбор узла,
// а с ним панель редактора, остаются. Меню слушает Escape в фазе capture и гасит его, поэтому
// порядок подписки неважен: useMapKeys подписан раньше меню или переподписался позже.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useMapKeys } from './useMapKeys';
import { Dropdown } from '../Dropdown';
import type { FlowNode, FlowEdge } from '../modeMapFlow';

afterEach(cleanup);

const NODES: FlowNode[] = [{ id: 'a', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'a' } }];
const EDGES: FlowEdge[] = [];
const noop = () => {};

// Зависимости useMapKeys стабильны: его слушатель не переподписывается, когда открывается меню, — как в редакторе.
function Editor({ nodes = NODES }: { nodes?: FlowNode[] }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('a');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  useMapKeys({ nodes, edges: EDGES, selectedNodeId, selectedEdgeId: null, setNodes: noop, setEdges: noop,
    setSelectedNodeId, setSelectedEdgeId: noop, scheduleSave: noop, pushHistory: noop, undo: noop, redo: noop });
  return (
    <>
      <output aria-label="Выбранный узел">{selectedNodeId ?? 'нет'}</output>
      <div ref={anchorRef}><button type="button" onClick={() => setMenuOpen(true)}>Ещё</button></div>
      {menuOpen && (
        <Dropdown portal anchorRef={anchorRef} onClose={() => setMenuOpen(false)} role="menu" label="Ещё">
          <button type="button" role="menuitem">Выделить всё</button>
        </Dropdown>
      )}
    </>
  );
}

const selected = () => screen.getByLabelText('Выбранный узел').textContent;
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

describe('useMapKeys + Dropdown: Escape при открытом меню', () => {
  it('без меню Escape снимает выбор узла', () => {
    render(<Editor />);
    escape();
    expect(selected()).toBe('нет');
  });

  it('меню открыто после подписки useMapKeys: первый Escape закрывает только меню, второй снимает выбор', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Выделить всё' }));
    escape();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(selected()).toBe('a');
    escape();
    expect(selected()).toBe('нет');
  });

  it('useMapKeys переподписался, пока меню открыто: Escape всё равно закрывает только меню', () => {
    const { rerender } = render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    rerender(<Editor nodes={[...NODES]} />); // новые фигуры → эффект useMapKeys подписывается заново, после меню
    escape();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(selected()).toBe('a');
  });
});
