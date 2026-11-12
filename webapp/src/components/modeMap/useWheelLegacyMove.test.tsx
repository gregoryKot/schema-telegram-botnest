// @vitest-environment jsdom
// Перенос оценок из узла карты (#1065) в концептуализацию — через настоящий WheelProvider.
// Ревью 2026-11-12: хук принимал черновик на экране за подтверждение сервера и чистил узел
// до записи — сбой или уход со страницы терял оценки. Узел очищается только после ответа.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { NodeActionsContext, type NodeActions } from '../modeMapActions';
import { WheelProvider, WHEEL_SAVE_DELAY_MS } from './WheelProvider';
import { ConceptSyncContext, type ConceptSyncState } from './conceptSyncContext';
import type { ClientConceptState } from './clientConceptContext';
import type { WheelView } from './needWheel';
import { useWheelLegacyMove } from './useWheelLegacyMove';
import type { ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';

const saveConceptNeeds = vi.fn();
vi.mock('../../api', () => ({
  api: { saveConceptNeeds: (...a: unknown[]) => saveConceptNeeds(...a), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));

const concept = (needLinks: ConceptNeedLink[]): ClientConceptState => ({ schemaIds: [], modeIds: [], modeLinks: [], schemaLinks: [], needLinks });
const PLAY: WheelView = { period: 'now', ratings: { now: { play: 9 } }, notes: { now: { play: 'Мало игры' } } };
const PLAY_LINK: ConceptNeedLink = { needId: 'play', ratings: { now: 9 }, notes: { now: 'Мало игры' } };
const BOND: WheelView = { compare: true, ratings: { child: { attachment: 2 } } };
const BOND_LINK: ConceptNeedLink = { needId: 'attachment', ratings: { child: 2 }, notes: {} };

const Move = ({ id, view }: { id: string; view: WheelView }) => { useWheelLegacyMove(id, view); return null; };

/** Карта с колёсами `initial`: концептуализация и узлы живут в состоянии, как на холсте. */
function setup(initial: Record<string, WheelView>) {
  const patched = vi.fn();
  const Host = () => {
    const [state, setState] = useState<ClientConceptState>(concept([]));
    const [nodes, setNodes] = useState(initial);
    const sync = { concept: state, replaceConcept: (c: { needLinks?: ConceptNeedLink[] }) => setState(concept(c.needLinks ?? [])) } as unknown as ConceptSyncState;
    const actions = {
      duplicate: vi.fn(), remove: vi.fn(), edit: vi.fn(), rename: vi.fn(),
      patchData: (id: string, patch: { wheel?: WheelView }) => { patched(id, patch); setNodes((n) => ({ ...n, [id]: patch.wheel ?? {} })); },
    } as unknown as NodeActions;
    return (
      <ConceptSyncContext.Provider value={sync}>
        <WheelProvider clientId={7}>
          <NodeActionsContext.Provider value={actions}>
            {Object.entries(nodes).map(([id, view]) => <Move key={id} id={id} view={view} />)}
          </NodeActionsContext.Provider>
        </WheelProvider>
      </ConceptSyncContext.Provider>
    );
  };
  render(<Host />);
  return { patched };
}
const pause = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(WHEEL_SAVE_DELAY_MS + 10); }); };

beforeEach(() => { vi.useFakeTimers(); saveConceptNeeds.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('useWheelLegacyMove + WheelProvider', () => {
  it('пока сервер не ответил, узел оценки держит; ответил — оценки в концептуализации, в узле остался вид', async () => {
    let answer: (v: { needLinks: ConceptNeedLink[] }) => void = () => {};
    saveConceptNeeds.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const { patched } = setup({ w: PLAY });

    expect(patched).not.toHaveBeenCalled(); // черновик на экране — ещё не запись
    await pause();
    expect(saveConceptNeeds).toHaveBeenCalledWith(7, [PLAY_LINK]);
    expect(patched).not.toHaveBeenCalled(); // запрос ушёл, ответа нет

    await act(async () => { answer({ needLinks: [PLAY_LINK] }); await Promise.resolve(); });
    expect(patched).toHaveBeenCalledTimes(1);
    expect(patched).toHaveBeenCalledWith('w', { wheel: { period: 'now' } });
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1); // очищенный узел новой записи не просит
  });

  it('запись упала — оценки остаются в узле карты', async () => {
    saveConceptNeeds.mockRejectedValue(new Error('offline'));
    const { patched } = setup({ w: PLAY });
    await pause();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(patched).not.toHaveBeenCalled();
  });

  it('два колеса с оценками на одной карте — в концептуализацию уходят оба, оба узла очищаются', async () => {
    saveConceptNeeds.mockImplementation((_id: number, links: ConceptNeedLink[]) => Promise.resolve({ needLinks: links }));
    const { patched } = setup({ a: PLAY, b: BOND });
    await pause();
    expect(saveConceptNeeds).toHaveBeenLastCalledWith(7, [BOND_LINK, PLAY_LINK]);
    await pause();
    expect(patched).toHaveBeenCalledWith('a', { wheel: { period: 'now' } });
    expect(patched).toHaveBeenCalledWith('b', { wheel: { compare: true } });
    expect(patched).toHaveBeenCalledTimes(2);
  });

  it('сервер вернул колесо иначе, чем просили, — тот же запрос не повторяется по кругу', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: [] });
    const { patched } = setup({ w: PLAY });
    await pause();
    await pause();
    await pause();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(patched).not.toHaveBeenCalled();
  });
});
