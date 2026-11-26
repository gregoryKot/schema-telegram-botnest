// @vitest-environment jsdom
// Осадка свежей схемы случая в ModeMapEditor: хук useSettleFresh подключён там, где
// живёт состояние нод, и ловит оба входа — карту, открытую с флагом из сохранённого
// (кнопка «Открыть на холсте»), и вставку в уже открытую карту (пункт меню «Из
// концептуализации клиента»). React Flow в jsdom ничего не измеряет, поэтому холст
// подменён заглушкой, которая «измеряет» ноды так же, как это делает onNodesChange.
import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react';
import { ModeMapEditor } from './ModeMapEditor';
import type { ModeMapNode } from '../api';
import type { FlowNode } from './modeMapFlow';

const updateModeMap = vi.fn();
vi.mock('../api', () => ({
  api: { updateModeMap: (...a: unknown[]) => updateModeMap(...a), getConceptualization: () => Promise.resolve(null) },
  reportClientError: vi.fn(),
}));
vi.mock('./ModeMapPalette', () => ({ ModeMapPalette: () => null }));

const SIZE = { width: 250, height: 400 };
const FRESH: ModeMapNode[] = [
  { id: 'a', type: 'schema', position: { x: 0, y: 0 }, data: { label: 'Первая', settle: true } },
  { id: 'b', type: 'schema', position: { x: 0, y: 200 }, data: { label: 'Вторая', settle: true } },
];

vi.mock('./ModeMapCanvas', () => ({
  ModeMapCanvas: ({ nodes, setNodes }: { nodes: FlowNode[]; setNodes: (n: FlowNode[]) => void }) => {
    // «замер»: каждой ноде без размера выдаётся 250×400 — длиннее, чем ей отвели
    useEffect(() => {
      if (nodes.some((n) => !n.measured)) {
        setNodes(nodes.map((n) => (n.measured ? n : { ...n, measured: SIZE })));
      }
    }, [nodes, setNodes]);
    return (
      <button type="button" onClick={() => setNodes([...nodes,
        { id: 'ins1', type: 'schema', position: { x: 0, y: 100 }, data: { label: 'Вставка 1', settle: true } },
        { id: 'ins2', type: 'schema', position: { x: 0, y: 300 }, data: { label: 'Вставка 2', settle: true } },
      ])}>вставить</button>
    );
  },
}));

const lastSaved = () => (updateModeMap.mock.calls.at(-1)![1] as { nodes: ModeMapNode[] }).nodes;
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(1300); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  updateModeMap.mockResolvedValue({});
  localStorage.clear();
  window.innerWidth = 1200;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('ModeMapEditor: осадка свежей схемы', () => {
  it('карта открыта с флагом из сохранённой: после замера колонка раздвинута, а сохранена уже без флага', async () => {
    render(<ModeMapEditor mapId={1} clientId={7} kind="personality" initialNodes={FRESH} initialEdges={[]} />);
    await flush();

    expect(updateModeMap).toHaveBeenCalledTimes(1);
    const saved = lastSaved();
    expect(saved.map((n) => n.position.y)).toEqual([0, 424]);
    expect(saved.every((n) => !('settle' in n.data))).toBe(true);
  });

  it('вставка в открытую карту: оседают только вставленные ноды, старые стоят где стояли', async () => {
    const old: ModeMapNode = { id: 'old', type: 'schema', position: { x: 0, y: 0 }, data: { label: 'Моя схема' } };
    render(<ModeMapEditor mapId={1} clientId={7} kind="personality" initialNodes={[old]} initialEdges={[]} />);
    await flush();
    expect(updateModeMap).not.toHaveBeenCalled(); // без флага осадка не просыпается

    fireEvent.click(screen.getByText('вставить'));
    await flush();

    const saved = lastSaved();
    expect(saved.find((n) => n.id === 'old')!.position.y).toBe(0);
    expect(saved.find((n) => n.id === 'ins1')!.position.y).toBe(100);
    expect(saved.find((n) => n.id === 'ins2')!.position.y).toBe(524); // 100 + 400 + 24
    expect(saved.every((n) => !('settle' in n.data))).toBe(true);
  });
});
