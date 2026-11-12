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
  act,
} from '@testing-library/react';
import { ModeMapViewer } from './ModeMapViewer';
import type { ModeMapMeta, ModeMapFull } from '../api';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

const listMyModeMaps = vi.fn();
const getMyModeMap = vi.fn();
const reportClientError = vi.fn();
vi.mock('../api', () => ({
  api: {
    listMyModeMaps: (...a: unknown[]) => listMyModeMaps(...a),
    getMyModeMap: (...a: unknown[]) => getMyModeMap(...a),
  },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
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

// Данные карты грузятся в mount-эффекте ModeMapViewer (listMyModeMaps /
// getMyModeMap) — обновление состояния прилетает из-под await, вне act, и
// опрос findByText (timeout 8000) с ним иногда расходится. Оборачиваем сам
// render в act(async): он дожидается промисов, дальше ассерт синхронный.
describe('ModeMapViewer — пустое состояние', () => {
  it('без карт показывает «Карты режимов пока нет»', async () => {
    listMyModeMaps.mockResolvedValue([]);
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByText('Карты режимов пока нет')).toBeTruthy();
  });
});

describe('ModeMapViewer — загрузка и отображение карты', () => {
  it('автоматически загружает и показывает первую карту клиента', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Моя карта')]);
    getMyModeMap.mockResolvedValue(full(1, 'Моя карта'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByText('Триггер')).toBeTruthy();
    expect(getMyModeMap).toHaveBeenCalledWith(1);
  });

  it('одна карта — вкладок переключения не показывает', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Единственная')]);
    getMyModeMap.mockResolvedValue(full(1, 'Единственная'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByText('Триггер')).toBeTruthy();
    expect(screen.queryByText('Единственная')).toBeNull();
  });

  it('несколько карт — показывает вкладки, клик переключает активную', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getMyModeMap
      .mockResolvedValueOnce(full(1, 'Карта А'))
      .mockResolvedValueOnce(full(2, 'Карта Б'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByText('Триггер')).toBeTruthy();
    expect(screen.getByText('Карта А')).toBeTruthy();
    fireEvent.click(screen.getByText('Карта Б'));
    await waitFor(() => expect(getMyModeMap).toHaveBeenCalledWith(2));
  });
});

describe('ModeMapViewer — вкладки и загрузка (#906)', () => {
  it('вкладки карт — ds-seg-btn с aria-pressed у активной', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getMyModeMap.mockResolvedValue(full(1, 'Карта А'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    const a = screen.getByText('Карта А');
    const b = screen.getByText('Карта Б');
    expect(a.classList.contains('ds-seg-btn')).toBe(true);
    expect(a.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('на загрузке — силуэт, а не текст «Загрузка…»', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getMyModeMap.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByTestId('mm-skeleton')).toBeTruthy();
    expect(screen.queryByText('Загрузка…')).toBeNull();
  });
});

describe('ModeMapViewer — только просмотр (не редактируется)', () => {
  it('узлы не перетаскиваются (nodesDraggable=false) в отличие от редактора', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getMyModeMap.mockResolvedValue(full(1, 'Карта А'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    const node = screen.getByText('Триггер').closest('.react-flow__node')!;
    expect(node.className).not.toContain('draggable');
  });
});

describe('ModeMapViewer — легенда', () => {
  it('кнопка легенды на панели показывает и скрывает «Легенда»', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А')]);
    getMyModeMap.mockResolvedValue(full(1, 'Карта А'));
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<ModeMapViewer />);
    });
    const { container } = result;
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

// Шов «ответ сервера → контекст колеса → узел»: оценки клиент получает вместе со своей картой.
describe('ModeMapViewer — колесо потребностей у клиента', () => {
  const wheelMap = (extra: { needRatings?: unknown } = {}) => ({
    ...full(1, 'Карта'),
    nodes: [{ id: 'w', type: 'needs', position: { x: 0, y: 0 }, data: { label: 'Потребности', wheel: { period: 'now', compare: true } } }],
    ...extra,
  });
  async function openMap(map: ReturnType<typeof wheelMap>) {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта')]);
    getMyModeMap.mockResolvedValue(map);
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<ModeMapViewer />);
    });
    return result.container;
  }
  const sector = (c: HTMLElement, id: string) => c.querySelector(`button[data-need="${id}"]`)!.textContent;

  it('оценки пришли с картой — у сектора процент выбранного периода, поверх контур детства', async () => {
    const c = await openMap(wheelMap({ needRatings: [{ needId: 'attachment', ratings: { child: 2, now: 7 } }] }));
    expect(sector(c, 'attachment')).toContain('70%');
    expect(c.querySelector('[data-layer="childhood"]')).not.toBeNull();
    expect(c.textContent).toContain('контур — детство');
  });

  it('оценок в ответе нет (старый сервер) — названия и «—», не ноль', async () => {
    const c = await openMap(wheelMap());
    expect(sector(c, 'attachment')).toContain('Привязанность');
    expect(sector(c, 'attachment')).toContain('—');
    expect(sector(c, 'attachment')).not.toContain('%');
  });
});

// Сбой ≠ пусто (2026-11): отказ списка рисовал «Карты режимов пока нет», а
// промис карты шёл без catch (нашёл no-floating-promises) — пустой холст и
// unhandled rejection. Теперь «не удалось загрузить» на экране и отчёт наверх.
describe('ModeMapViewer — отказ сервера', () => {
  it('список карт не загрузился — «Не удалось загрузить», а не «Карты режимов пока нет»; отчёт ушёл', async () => {
    listMyModeMaps.mockRejectedValue(new Error('503'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить карту режимов');
    expect(screen.queryByText('Карты режимов пока нет')).toBeNull();
    expect(screen.queryByTestId('mm-skeleton')).toBeNull();
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'modeMap.viewer' }));
  });

  it('карта не загрузилась — ошибка на экране, без вечного силуэта; повтор тапом по вкладке её открывает', async () => {
    listMyModeMaps.mockResolvedValue([meta(1, 'Карта А'), meta(2, 'Карта Б')]);
    getMyModeMap.mockRejectedValueOnce(new Error('503'));
    await act(async () => {
      render(<ModeMapViewer />);
    });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить карту режимов');
    expect(screen.queryByTestId('mm-skeleton')).toBeNull();
    expect(reportClientError).toHaveBeenCalledTimes(1);

    getMyModeMap.mockResolvedValueOnce(full(1, 'Карта А'));
    await act(async () => {
      fireEvent.click(screen.getByText('Карта А'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Триггер')).toBeTruthy();
  });
});
