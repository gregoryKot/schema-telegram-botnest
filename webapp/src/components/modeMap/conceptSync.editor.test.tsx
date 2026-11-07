// @vitest-environment jsdom
// Поля → холст (#963) в настоящем редакторе: строка связи видит режим, которого
// нет на карте; «Добавить на карту» дописывает только его, расставленное не
// двигает, а дописанное отсюда обратно в поля не уходит.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { ModeMapEditor } from '../ModeMapEditor';
import type { ModeMapNode } from '../../api';
import { installFlowTestPolyfills } from '../../test-support/renderWithFlow';
import { BACK_SYNC_DELAY_MS } from './useConceptBackSync';

const getConceptualization = vi.fn();
const appendConceptualization = vi.fn();
const trackEvent = vi.fn();
vi.mock('../../api', () => ({
  api: {
    updateModeMap: () => Promise.resolve({}),
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    appendConceptualization: (...a: unknown[]) => appendConceptualization(...a),
    trackEvent: (...a: unknown[]) => trackEvent(...a),
    listCustomModes: () => Promise.resolve([]),
  },
  reportClientError: vi.fn(),
}));

const CHILD: ModeMapNode = { id: 'n1', type: 'child', position: { x: 40, y: 60 }, data: { label: 'Уязвимый Ребёнок', modeId: 'vulnerable_child' } };
const CONCEPT = { schemaIds: [], modeIds: ['vulnerable_child', 'demanding_critic'], modeLinks: [] };
const nodeEl = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  vi.clearAllMocks();
  getConceptualization.mockResolvedValue(CONCEPT);
  appendConceptualization.mockResolvedValue(CONCEPT);
  window.innerWidth = 1200;
});
afterEach(() => cleanup());

describe('ModeMapEditor — поля → холст', () => {
  it('«Добавить на карту» дописывает недостающий режим, старый узел стоит на месте, в поля ничего не уходит', async () => {
    // Пока карта открыта, в полях появилась ещё схема: кнопка берёт свежую концептуализацию,
    // и дописанное ею холст не принимает за правку терапевта.
    getConceptualization.mockResolvedValueOnce(CONCEPT).mockResolvedValueOnce({ ...CONCEPT, schemaIds: ['failure'] });
    await act(async () => {
      render(<ModeMapEditor mapId={1} clientId={7} kind="problem" initialNodes={[CHILD]} initialEdges={[]} />);
    });
    const line = await screen.findByText('В концептуализации есть, на карте нет: Требовательный Критик');
    expect(line).toBeTruthy();
    const before = nodeEl('n1')?.style.transform;
    expect(before).toContain('translate');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Добавить на карту' })); });
    await waitFor(() => expect(screen.getAllByText('Требовательный Критик').some((el) => el.closest('.react-flow__node'))).toBe(true));
    expect(document.querySelector('.react-flow__node[data-id^="cc_schema_failure"]')).toBeTruthy();
    expect(nodeEl('n1')?.style.transform).toBe(before);
    expect(trackEvent).toHaveBeenCalledWith('concept_sync_to_map');
    expect(screen.getByText('Карта совпадает с концептуализацией')).toBeTruthy();

    await act(async () => { await new Promise((r) => setTimeout(r, BACK_SYNC_DELAY_MS + 100)); });
    expect(appendConceptualization).not.toHaveBeenCalled();
  });
});
