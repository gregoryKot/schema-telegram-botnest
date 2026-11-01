// @vitest-environment jsdom
// Схемы клиента в редакторе карты: один запрос концептуализации кормит и узлы
// режимов (таблетки по связям), и палитру («Схемы клиента»). Связи только читаются
// и в сохранённую карту не попадают.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ModeMapEditor } from './ModeMapEditor';
import type { ModeMapNode } from '../api';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

const updateModeMap = vi.fn();
const getConceptualization = vi.fn();
vi.mock('../api', () => ({
  api: {
    updateModeMap: (...a: unknown[]) => updateModeMap(...a),
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    listCustomModes: () => Promise.resolve([]),
  },
  reportClientError: vi.fn(),
}));

const CHILD: ModeMapNode = { id: 'n1', type: 'child', position: { x: 0, y: 0 }, data: { label: 'Уязвимый Ребёнок', modeId: 'vulnerable_child' } };
const CONCEPT = {
  schemaIds: ['abandonment', 'mistrust'], modeIds: ['vulnerable_child'],
  modeLinks: [{ modeId: 'vulnerable_child', alias: '', schemaIds: ['abandonment'], needIds: [], origin: '', manifest: '', strategy: '' }],
};

async function renderEditor(nodes: ModeMapNode[], kind: 'problem' | 'couple' = 'problem') {
  await act(async () => {
    render(<ModeMapEditor mapId={1} clientId={7} kind={kind} initialNodes={nodes} initialEdges={[]} />);
  });
}
// Таблетки ищем внутри узла режима: названия схем клиента есть и в палитре.
const childNodeText = () => document.querySelector('.react-flow__node[data-id="n1"]')?.textContent ?? '';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  vi.clearAllMocks();
  updateModeMap.mockResolvedValue({});
  getConceptualization.mockResolvedValue(CONCEPT);
  window.innerWidth = 1200;
});
afterEach(() => cleanup());

describe('ModeMapEditor — схемы клиента', () => {
  it('узел режима показывает схему из связей клиента, концептуализация грузится один раз', async () => {
    await renderEditor([CHILD]);
    const pill = screen.getAllByText('Покинутость / Нестабильность').find(el => el.closest('.react-flow__node'));
    expect(pill).toBeTruthy();
    expect(getConceptualization).toHaveBeenCalledTimes(1);
  });

  it('режим снят с концептуализации — спящая связь на узле не показывается', async () => {
    getConceptualization.mockResolvedValue({ ...CONCEPT, modeIds: [] });
    await renderEditor([CHILD]);
    expect(childNodeText()).toContain('Уязвимый Ребёнок');
    expect(childNodeText()).not.toContain('Покинутость');
  });

  it('схема уже стоит на холсте фигурой — на узле режима её таблетки нет', async () => {
    const SCHEMA: ModeMapNode = { id: 's1', type: 'schema', position: { x: 400, y: 0 }, data: { label: 'Покинутость / Нестабильность', schemaId: 'abandonment' } };
    await renderEditor([CHILD, SCHEMA]);
    expect(childNodeText()).toContain('Уязвимый Ребёнок');
    expect(childNodeText()).not.toContain('Покинутость');
  });

  it('карта пары — связи клиента на узлах режимов не показываются', async () => {
    await renderEditor([CHILD], 'couple');
    expect(childNodeText()).toContain('Уязвимый Ребёнок');
    expect(childNodeText()).not.toContain('Покинутость');
  });

  it('клик по схеме клиента в палитре ставит на холст узел «схема»', async () => {
    await renderEditor([]);
    const item = screen.getByLabelText('Схема клиента: Недоверие / Ожидание жестокого обращения');
    fireEvent.click(item);
    expect(screen.getAllByText('Недоверие / Ожидание жестокого обращения').some(el => el.closest('.react-flow__node'))).toBe(true);
  });

  it('сбой загрузки: палитра честно говорит «не удалось», узлы остаются без таблеток связей', async () => {
    getConceptualization.mockImplementation(() => Promise.reject(new Error('offline')));
    await renderEditor([CHILD]);
    expect(screen.getByText('Не удалось загрузить схемы клиента')).toBeTruthy();
    expect(screen.queryByText('Покинутость / Нестабильность')).toBeNull();
  });
});
