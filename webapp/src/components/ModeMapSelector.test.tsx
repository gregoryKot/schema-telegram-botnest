// @vitest-environment jsdom
// ModeMapSelector — вкладки карт режимов клиента (3% покрытия). Сам
// ModeMapEditor мокаем стабом (он тяжёлый, xyflow-based и уже отдельно
// покрыт своими тестами) — здесь проверяем логику самого селектора: список
// карт, создание/переименование/удаление, выбор типа новой карты, пустое
// состояние.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ModeMapSelector } from './ModeMapSelector';
import type { ModeMapMeta, ModeMapFull } from '../api';

const listModeMaps = vi.fn();
const getModeMap = vi.fn();
const createModeMap = vi.fn();
const deleteModeMap = vi.fn();
const updateModeMap = vi.fn();
vi.mock('../api', () => ({
  api: {
    listModeMaps: (...a: unknown[]) => listModeMaps(...a),
    getModeMap: (...a: unknown[]) => getModeMap(...a),
    createModeMap: (...a: unknown[]) => createModeMap(...a),
    deleteModeMap: (...a: unknown[]) => deleteModeMap(...a),
    updateModeMap: (...a: unknown[]) => updateModeMap(...a),
  },
}));

vi.mock('./ModeMapEditor', () => ({
  ModeMapEditor: ({ mapId, kind }: { mapId: number; kind: string }) => (
    <div data-testid="mm-editor-stub">
      editor:{mapId}:{kind}
    </div>
  ),
}));

function meta(
  id: number,
  title: string,
  kind: ModeMapMeta['kind'] = 'problem',
): ModeMapMeta {
  return { id, title, kind, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}
function full(
  id: number,
  title: string,
  kind: ModeMapMeta['kind'] = 'problem',
): ModeMapFull {
  return { ...meta(id, title, kind), nodes: [], edges: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('ModeMapSelector — пустое состояние', () => {
  it('без карт показывает выбор типа первой карты', async () => {
    listModeMaps.mockResolvedValue([]);
    render(<ModeMapSelector clientId={1} />);
    expect(
      await screen.findByText('Нет карт режимов', {}, { timeout: 8000 }),
    ).toBeTruthy();
    expect(screen.getByText('Карта личности')).toBeTruthy();
    expect(screen.getByText('Карта ситуации')).toBeTruthy();
    expect(screen.getByText('Карта пары')).toBeTruthy();
  });

  it('клик по типу карты в пустом состоянии создаёт и открывает её', async () => {
    listModeMaps.mockResolvedValue([]);
    createModeMap.mockResolvedValue(full(9, 'Карта личности', 'personality'));
    render(<ModeMapSelector clientId={1} />);
    await screen.findByText('Нет карт режимов', {}, { timeout: 8000 });
    fireEvent.click(screen.getByText('Карта личности'));
    expect(createModeMap).toHaveBeenCalledWith(
      1,
      'Карта личности',
      'personality',
    );
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(
        'editor:9:personality',
      ),
    );
  });
});

describe('ModeMapSelector — список карт и переключение', () => {
  it('загружает карты клиента и автоматически открывает первую', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getModeMap.mockResolvedValue(full(1, 'Карта А'));
    render(<ModeMapSelector clientId={5} />);
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(
        'editor:1:problem',
      ),
    );
    expect(screen.getByText('Карта А')).toBeTruthy();
    expect(screen.getByText('Карта Б')).toBeTruthy();
  });

  it('клик по вкладке другой карты подгружает и показывает её', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getModeMap
      .mockResolvedValueOnce(full(1, 'Карта А'))
      .mockResolvedValueOnce(full(2, 'Карта Б'));
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    fireEvent.click(screen.getByText('Карта Б'));
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(
        'editor:2:problem',
      ),
    );
  });
});

describe('ModeMapSelector — создание новой карты через меню', () => {
  it('кнопка «Новая карта» открывает список типов, клик создаёт карту нужного вида', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getModeMap.mockResolvedValue(full(1, 'Карта А'));
    createModeMap.mockResolvedValue(full(2, 'Пара 1', 'couple'));
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    fireEvent.click(screen.getByText('Новая карта'));
    fireEvent.click(screen.getByText('Карта пары'));
    expect(createModeMap).toHaveBeenCalledWith(5, 'Пара 1', 'couple');
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(
        'editor:2:couple',
      ),
    );
  });
});

describe('ModeMapSelector — переименование и удаление карты', () => {
  it('двойной клик по вкладке переименовывает карту через API', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Старое имя')]);
    getModeMap.mockResolvedValue(full(1, 'Старое имя'));
    updateModeMap.mockResolvedValue(full(1, 'Новое имя'));
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    fireEvent.doubleClick(screen.getByText('Старое имя'));
    const input = screen.getByDisplayValue('Старое имя');
    fireEvent.change(input, { target: { value: 'Новое имя' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateModeMap).toHaveBeenCalledWith(1, { title: 'Новое имя' });
    expect(
      await screen.findByText('Новое имя', {}, { timeout: 8000 }),
    ).toBeTruthy();
  });

  it('удаление подтверждённой картой убирает её из списка и открывает следующую', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getModeMap
      .mockResolvedValueOnce(full(1, 'Карта А'))
      .mockResolvedValueOnce(full(2, 'Карта Б'));
    deleteModeMap.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    fireEvent.click(screen.getByLabelText('Удалить карту'));
    expect(deleteModeMap).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(screen.getByTestId('mm-editor-stub').textContent).toBe(
        'editor:2:problem',
      ),
    );
    expect(screen.queryByText('Карта А')).toBeNull();
  });

  it('отказ от подтверждения не удаляет карту', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getModeMap.mockResolvedValue(full(1, 'Карта А'));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    fireEvent.click(screen.getByLabelText('Удалить карту'));
    expect(deleteModeMap).not.toHaveBeenCalled();
    expect(screen.getByText('Карта А')).toBeTruthy();
  });

  it('единственная карта не показывает кнопку удаления', async () => {
    listModeMaps.mockResolvedValue([meta(1, 'Единственная')]);
    getModeMap.mockResolvedValue(full(1, 'Единственная'));
    render(<ModeMapSelector clientId={5} />);
    await screen.findByTestId('mm-editor-stub', {}, { timeout: 8000 });
    expect(screen.queryByLabelText('Удалить карту')).toBeNull();
  });
});

describe('ModeMapSelector — смена клиента сбрасывает и грузит заново', () => {
  it('смена clientId запрашивает карты нового клиента', async () => {
    listModeMaps
      .mockResolvedValueOnce([meta(1, 'Карта клиента 1')])
      .mockResolvedValueOnce([meta(2, 'Карта клиента 2')]);
    getModeMap
      .mockResolvedValueOnce(full(1, 'Карта клиента 1'))
      .mockResolvedValueOnce(full(2, 'Карта клиента 2'));
    const { rerender } = render(<ModeMapSelector clientId={1} />);
    await screen.findByText('Карта клиента 1', {}, { timeout: 8000 });
    rerender(<ModeMapSelector clientId={2} />);
    expect(
      await screen.findByText('Карта клиента 2', {}, { timeout: 8000 }),
    ).toBeTruthy();
    expect(listModeMaps).toHaveBeenCalledWith(2);
  });
});
