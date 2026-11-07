// @vitest-environment jsdom
// Выбор типа графической карты (#963): пять типов по порядку, «Концептуализация»
// собирается из полей с сервера и недоступна, пока полей нет или они грузятся,
// «Свободный холст» — пустая карта. Редактор — стаб (он покрыт своими тестами).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ModeMapSelector } from './ModeMapSelector';
import { AddressFormContext } from '../utils/addressForm';
import { conceptMapTitle } from './modeMap/mapKinds';
import { paperSignName } from '../test-support/paperSign';

const listModeMaps = vi.fn();
const getModeMap = vi.fn();
const createModeMap = vi.fn();
const updateModeMap = vi.fn();
const deleteModeMap = vi.fn();
const getConceptualization = vi.fn();
vi.mock('../api', () => ({
  api: {
    listModeMaps: (...a: unknown[]) => listModeMaps(...a),
    getModeMap: (...a: unknown[]) => getModeMap(...a),
    createModeMap: (...a: unknown[]) => createModeMap(...a),
    updateModeMap: (...a: unknown[]) => updateModeMap(...a),
    deleteModeMap: (...a: unknown[]) => deleteModeMap(...a),
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('./ModeMapEditor', () => ({
  ModeMapEditor: ({ mapId, kind, initialNodes }: { mapId: number; kind: string; initialNodes: unknown[] }) => (
    <div data-testid="mm-editor-stub">editor:{mapId}:{kind}:{initialNodes.length}</div>
  ),
}));

const created = (id: number, title: string, kind: string) =>
  ({ id, title, kind, nodes: [], edges: [], createdAt: '', updatedAt: '' });
const kindButton = (label: string) => screen.getByText(label).closest('button') as HTMLButtonElement;
const FILL_HINT = 'Заполни поля концептуализации, и карта соберётся сама';
const LINK_NOTE = 'Карты связаны с концептуализацией клиента: режимы, схемы и линии схема — режим с карты дописываются в поля, а удаление с карты поля не трогает. Карта пары живёт отдельно.';

async function renderEmpty(form: 'ty' | 'vy' = 'ty') {
  listModeMaps.mockResolvedValue([]);
  await act(async () => {
    render(
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <ModeMapSelector clientId={4} />
      </AddressFormContext.Provider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateModeMap.mockResolvedValue({});
});

describe('ModeMapSelector — типы графических карт', () => {
  it('пустой экран: «Пока нет графических карт» и пять типов по порядку', async () => {
    getConceptualization.mockResolvedValue(null);
    await renderEmpty();
    expect(screen.getByText('Пока нет графических карт')).toBeTruthy();
    expect(paperSignName(document.querySelector('.mm2-center .pp-empty svg'))).toBe('Cluster'); // круги режимов, не чашка
    const names = Array.from(document.querySelectorAll('.mm2-kind-card .mm2-kind-name')).map(n => n.textContent);
    expect(names).toEqual(['Концептуализация', 'Карта режимов', 'Карта ситуации', 'Карта пары', 'Свободный холст']);
  });

  it('меню «Новая карта» показывает те же пять типов в том же порядке', async () => {
    getConceptualization.mockResolvedValue(null);
    listModeMaps.mockResolvedValue([{ id: 1, title: 'А', kind: 'problem', createdAt: '', updatedAt: '' }]);
    getModeMap.mockResolvedValue(created(1, 'А', 'problem'));
    await act(async () => { render(<ModeMapSelector clientId={4} />); });
    fireEvent.click(screen.getByText('Новая карта'));
    const menu = document.querySelector('.mm2-kind-menu') as HTMLElement;
    expect(within(menu).getAllByRole('button').map(b => b.querySelector('.mm2-kind-name')?.textContent)).toEqual([
      'Концептуализация', 'Карта режимов', 'Карта ситуации', 'Карта пары', 'Свободный холст',
    ]);
  });

  it('концептуализация без режимов и схем — тип недоступен, подсказка в обеих формах', async () => {
    getConceptualization.mockResolvedValue({ modeIds: [], schemaIds: [] });
    await renderEmpty('ty');
    expect(kindButton('Концептуализация').disabled).toBe(true);
    expect(screen.getByText(FILL_HINT)).toBeTruthy();
    expect(kindButton('Карта режимов').disabled).toBe(false);
  });

  it('«вы»: подсказка во множественном числе', async () => {
    getConceptualization.mockResolvedValue(null);
    await renderEmpty('vy');
    expect(screen.getByText('Заполните поля концептуализации, и карта соберётся сама')).toBeTruthy();
  });

  it('концептуализация не загрузилась — тип недоступен со своей подсказкой, не «заполни поля»', async () => {
    getConceptualization.mockRejectedValue(new Error('500'));
    await renderEmpty();
    expect(kindButton('Концептуализация').disabled).toBe(true);
    expect(screen.getByText('Концептуализация не загрузилась — собрать карту из неё сейчас нельзя')).toBeTruthy();
    expect(screen.queryByText(FILL_HINT)).toBeNull();
  });

  it('до первой карты сказано, что карты связаны с концептуализацией: на пустом экране и в меню «Новая карта»', async () => {
    getConceptualization.mockResolvedValue(null);
    await renderEmpty();
    expect(document.querySelector('.mm2-kinds .mm2-kinds-note')?.textContent).toBe(LINK_NOTE);
    cleanup();
    listModeMaps.mockResolvedValue([{ id: 1, title: 'А', kind: 'problem', createdAt: '', updatedAt: '' }]);
    getModeMap.mockResolvedValue(created(1, 'А', 'problem'));
    await act(async () => { render(<ModeMapSelector clientId={4} />); });
    fireEvent.click(screen.getByText('Новая карта'));
    expect(document.querySelector('.mm2-kind-menu .mm2-kinds-note')?.textContent).toBe(LINK_NOTE);
  });

  it('пока поля грузятся — тип недоступен без спиннера и без подсказки «заполни»', async () => {
    getConceptualization.mockReturnValue(new Promise(() => {}));
    await renderEmpty();
    expect(kindButton('Концептуализация').disabled).toBe(true);
    expect(screen.queryByText(FILL_HINT)).toBeNull();
    expect(screen.getByText(/Соберётся из полей концептуализации клиента/)).toBeTruthy();
  });

  it('есть режимы — тип доступен; создание: карта kind concept с фигурами из полей', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'], schemaIds: [] });
    createModeMap.mockResolvedValue(created(30, conceptMapTitle(), 'concept'));
    await renderEmpty();
    expect(kindButton('Концептуализация').disabled).toBe(false);
    await act(async () => { fireEvent.click(kindButton('Концептуализация')); });
    expect(createModeMap).toHaveBeenCalledWith(4, conceptMapTitle(), 'concept');
    const [mapId, body] = updateModeMap.mock.calls[0] as [number, { nodes: { type: string }[] }];
    expect(mapId).toBe(30);
    expect(body.nodes.some(n => n.type === 'child')).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(`editor:30:concept:${body.nodes.length}`));
  });

  it('«Свободный холст» — пустая карта kind free «Холст 1», фигуры не пишутся', async () => {
    getConceptualization.mockResolvedValue(null);
    createModeMap.mockResolvedValue(created(31, 'Холст 1', 'free'));
    await renderEmpty();
    await act(async () => { fireEvent.click(kindButton('Свободный холст')); });
    expect(createModeMap).toHaveBeenCalledWith(4, 'Холст 1', 'free');
    expect(updateModeMap).not.toHaveBeenCalled();
    expect(screen.getByTestId('mm-editor-stub').textContent).toBe('editor:31:free:0');
  });

  it('сборка не удалась — пустая карта удалена, терапевт видит отказ', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'] });
    createModeMap.mockResolvedValue(created(32, 'x', 'concept'));
    updateModeMap.mockRejectedValue(new Error('500'));
    deleteModeMap.mockResolvedValue(undefined);
    await renderEmpty();
    await act(async () => { fireEvent.click(kindButton('Концептуализация')); });
    expect(deleteModeMap).toHaveBeenCalledWith(32);
    expect(screen.getByRole('alert').textContent).toBe('Не получилось создать карту. Попробуй ещё раз.');
    expect(screen.queryByTestId('mm-editor-stub')).toBeNull();
  });
});
