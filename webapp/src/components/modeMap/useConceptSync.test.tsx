// @vitest-environment jsdom
// Холст → поля (#963), «сохранил → нашёл»: фигура на холсте уходит в
// концептуализацию через append, ответ сервера заменяет концептуализацию в
// провайдере (её видят узлы и палитра), строка связи говорит, что записано.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { ModeMapKind } from '../../api';
import { ModeMapConceptProvider } from './ModeMapConceptProvider';
import { ConceptSyncLine } from './ConceptSyncLine';
import { useModeMapConcept } from './clientConceptContext';
import { BACK_SYNC_DELAY_MS } from './useConceptBackSync';
import type { GraphEdge, GraphNode } from './conceptSync';
import { CONCEPT_APPENDED_EVENT } from './conceptAppendedEvent';

const getConceptualization = vi.fn();
const appendConceptualization = vi.fn();
const trackEvent = vi.fn();
const reportClientError = vi.fn();
vi.mock('../../api', () => ({
  api: {
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    appendConceptualization: (...a: unknown[]) => appendConceptualization(...a),
    trackEvent: (...a: unknown[]) => trackEvent(...a),
  },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const CRITIC: GraphNode = { id: 'm1', type: 'critic', data: { modeId: 'demanding_critic', label: 'Требовательный Критик' } };
const CHILD: GraphNode = { id: 'm2', type: 'child', data: { modeId: 'vulnerable_child', label: 'Уязвимый Ребёнок' } };
const SCHEMA: GraphNode = { id: 's1', type: 'schema', data: { schemaId: 'defectiveness', label: 'Дефективность / Стыд' } };
const CONCEPT = { schemaIds: [], modeIds: ['vulnerable_child'], modeLinks: [] };
const generate = vi.fn();

function Probe() {
  const c = useModeMapConcept();
  return <div data-testid="probe">{c && c !== 'failed' ? c.modeIds.join(',') : String(c)}</div>;
}
function Harness({ nodes, edges = [], kind = 'problem' }: { nodes: GraphNode[]; edges?: GraphEdge[]; kind?: ModeMapKind }) {
  return (
    <ModeMapConceptProvider clientId={7} kind={kind} nodes={nodes} edges={edges}>
      <ConceptSyncLine onAddToMap={generate} />
      <Probe />
    </ModeMapConceptProvider>
  );
}
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const waitDelay = () => act(async () => { await vi.advanceTimersByTimeAsync(BACK_SYNC_DELAY_MS + 10); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  getConceptualization.mockResolvedValue(CONCEPT);
  appendConceptualization.mockImplementation((_id: unknown, body: { modeIds?: string[] }) =>
    Promise.resolve({ ...CONCEPT, modeIds: [...CONCEPT.modeIds, ...(body.modeIds ?? [])] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useConceptSync — холст → поля', () => {
  it('пока концептуализация грузится — скелетон строки, без текста и кнопок', () => {
    getConceptualization.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Harness nodes={[CHILD]} />);
    expect(container.querySelector('.mm2-sync[aria-busy="true"] .skel')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('открытие карты ничего не пишет, даже если на ней режим, которого нет в полях', async () => {
    render(<Harness nodes={[CHILD, CRITIC]} />);
    await settle();
    await waitDelay();
    expect(appendConceptualization).not.toHaveBeenCalled();
    expect(screen.getByText('Совпадает с концептуализацией')).toBeTruthy();
  });

  it('поставил режим → append {modeIds} → провайдер видит его → «Добавлено в концептуализацию: …»', async () => {
    const { rerender } = render(<Harness nodes={[CHILD]} />);
    await settle();
    rerender(<Harness nodes={[CHILD, CRITIC]} />);
    expect(appendConceptualization).not.toHaveBeenCalled(); // ждёт паузу
    await waitDelay();
    expect(appendConceptualization).toHaveBeenCalledTimes(1);
    expect(appendConceptualization).toHaveBeenCalledWith(7, { modeIds: ['demanding_critic'] });
    expect(screen.getByTestId('probe').textContent).toBe('vulnerable_child,demanding_critic');
    expect(screen.getByText('Добавлено в концептуализацию: Требовательный Критик')).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('concept_sync_from_map');
  });

  it('провёл линию схема → режим — уходит связь', async () => {
    const { rerender } = render(<Harness nodes={[CHILD, SCHEMA]} />);
    await settle();
    rerender(<Harness nodes={[CHILD, SCHEMA]} edges={[{ source: 's1', target: 'm2' }]} />);
    await waitDelay();
    expect(appendConceptualization).toHaveBeenCalledWith(7, { modeLinks: [{ modeId: 'vulnerable_child', schemaIds: ['defectiveness'] }] });
  });

  it('удалил узел — поля не трогаются', async () => {
    const { rerender } = render(<Harness nodes={[CHILD, CRITIC]} />);
    await settle();
    rerender(<Harness nodes={[CHILD]} />);
    await waitDelay();
    expect(appendConceptualization).not.toHaveBeenCalled();
  });

  it('карта пары в поля не пишет и говорит об этом', async () => {
    const { rerender } = render(<Harness nodes={[CHILD]} kind="couple" />);
    await settle();
    rerender(<Harness nodes={[CHILD, CRITIC]} kind="couple" />);
    await waitDelay();
    expect(appendConceptualization).not.toHaveBeenCalled();
    expect(screen.getByText('Карта пары в концептуализацию не пишет')).toBeTruthy();
  });

  it('сбой записи → «Не записалось…», узел остаётся, отказ в телеметрию; «Повторить» шлёт снова', async () => {
    appendConceptualization.mockRejectedValueOnce(new Error('offline'));
    const { rerender } = render(<Harness nodes={[CHILD]} />);
    await settle();
    rerender(<Harness nodes={[CHILD, CRITIC]} />);
    await waitDelay();
    expect(screen.getByRole('alert').textContent).toContain('Не записалось в концептуализацию');
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'therapist.modeMap' }));
    expect(trackEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await settle();
    expect(appendConceptualization).toHaveBeenCalledTimes(2);
    expect(appendConceptualization).toHaveBeenLastCalledWith(7, { modeIds: ['demanding_critic'] });
    expect(screen.getByText('Добавлено в концептуализацию: Требовательный Критик')).toBeTruthy();
  });

  it('ушёл с карты раньше паузы — поставленное досылается keepalive-запросом, вкладка полей узнаёт о записи', async () => {
    const heard = vi.fn();
    window.addEventListener(CONCEPT_APPENDED_EVENT, heard);
    const { rerender, unmount } = render(<Harness nodes={[CHILD]} />);
    await settle();
    rerender(<Harness nodes={[CHILD, CRITIC]} />);
    unmount();
    expect(appendConceptualization).toHaveBeenCalledWith(7, { modeIds: ['demanding_critic'] }, { keepalive: true });
    await settle();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONCEPT_APPENDED_EVENT, heard);
  });

  it('после записи вкладка «Концептуализация» получает ответ сервера (событие окна)', async () => {
    const heard = vi.fn();
    window.addEventListener(CONCEPT_APPENDED_EVENT, heard);
    const { rerender } = render(<Harness nodes={[CHILD]} />);
    await settle();
    rerender(<Harness nodes={[CHILD, CRITIC]} />);
    await waitDelay();
    window.removeEventListener(CONCEPT_APPENDED_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({
      clientId: 7, concept: { ...CONCEPT, modeIds: ['vulnerable_child', 'demanding_critic'] },
    });
  });
});
