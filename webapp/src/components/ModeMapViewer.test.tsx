// @vitest-environment jsdom
// ModeMapViewer — read-only просмотр карт режимов клиентом (0% покрытия).
// Реальный @xyflow/react (не мокаем) — это тонкий wrapper, ценность теста в
// загрузке списка карт, автовыборе первой, переключении между картами и
// пустом состоянии.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ModeMapViewer } from './ModeMapViewer';
import type { ModeMapMeta, ModeMapFull } from '../api';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

const listMyModeMaps = vi.fn();
const getMyModeMap = vi.fn();
vi.mock('../api', () => ({
  api: {
    listMyModeMaps: (...a: unknown[]) => listMyModeMaps(...a),
    getMyModeMap: (...a: unknown[]) => getMyModeMap(...a),
  },
}));

function meta(id: number, title: string): ModeMapMeta {
  return {
    id,
    title,
    kind: 'problem',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}
function full(id: number, title: string): ModeMapFull {
  return {
    ...meta(id, title),
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { label: 'Триггер' },
      },
    ],
    edges: [],
  };
}

beforeEach(() => {
  installFlowTestPolyfills();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('ModeMapViewer — пустое состояние', () => {
  it('без карт показывает «Карты режимов пока нет»', async () => {
    listMyModeMaps.mockResolvedValue([]);
    render(<ModeMapViewer />);
    expect(
      await screen.findByText('Карты режимов пока нет', {}, { timeout: 8000 }),
    ).toBeTruthy();
  });
});

describe('ModeMapViewer — загрузка и отображение карты', () => {
  it('автоматически загружает и показывает первую карту клиента', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Моя карта')]);
    getMyModeMap.mockResolvedValue(full(1, 'Моя карта'));
    render(<ModeMapViewer />);
    expect(
      await screen.findByText('Триггер', {}, { timeout: 8000 }),
    ).toBeTruthy();
    expect(getMyModeMap).toHaveBeenCalledWith(1);
  });

  it('одна карта — вкладок переключения не показывает', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Единственная')]);
    getMyModeMap.mockResolvedValue(full(1, 'Единственная'));
    render(<ModeMapViewer />);
    await screen.findByText('Триггер', {}, { timeout: 8000 });
    expect(screen.queryByText('Единственная')).toBeNull();
  });

  it('несколько карт — показывает вкладки, клик переключает активную', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getMyModeMap
      .mockResolvedValueOnce(full(1, 'Карта А'))
      .mockResolvedValueOnce(full(2, 'Карта Б'));
    render(<ModeMapViewer />);
    await screen.findByText('Триггер', {}, { timeout: 8000 });
    expect(screen.getByText('Карта А')).toBeTruthy();
    fireEvent.click(screen.getByText('Карта Б'));
    await waitFor(() => expect(getMyModeMap).toHaveBeenCalledWith(2));
  });
});

describe('ModeMapViewer — только просмотр (не редактируется)', () => {
  it('узлы не перетаскиваются (nodesDraggable=false) в отличие от редактора', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getMyModeMap.mockResolvedValue(full(1, 'Карта А'));
    render(<ModeMapViewer />);
    await screen.findByText('Триггер', {}, { timeout: 8000 });
    const node = screen.getByText('Триггер').closest('.react-flow__node')!;
    expect(node.className).not.toContain('draggable');
  });
});

describe('ModeMapViewer — легенда', () => {
  it('кнопка легенды на панели показывает и скрывает «Легенда»', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getMyModeMap.mockResolvedValue(full(1, 'Карта А'));
    const { container } = render(<ModeMapViewer />);
    await screen.findByText('Триггер', {}, { timeout: 8000 });
    expect(screen.queryByText('Легенда')).toBeNull();
    const legendBtn = container.querySelectorAll(
      '.react-flow__panel button',
    )[3];
    fireEvent.click(legendBtn);
    expect(screen.getByText('Легенда')).toBeTruthy();
    fireEvent.click(legendBtn);
    expect(screen.queryByText('Легенда')).toBeNull();
  });
});
