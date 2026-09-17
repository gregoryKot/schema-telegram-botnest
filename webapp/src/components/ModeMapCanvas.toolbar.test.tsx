// @vitest-environment jsdom
// ModeMapCanvas — тулбар холста карты режимов (1% покрытия, самый большой
// провал в семье ModeMap). Проверяем реальное поведение тулбара: авто-
// расположение действительно двигает узлы, шаблоны реально вставляют граф,
// схемы клиента реально пишутся в выбранный узел, undo/redo реально
// восстанавливает модель — а не просто «кнопка есть».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  renderCanvas,
  mmNode,
  mmEdge,
  readModel,
  getConceptualization,
} from './ModeMapCanvas.test-helpers';
import {
  installFlowTestPolyfills,
  clickToolbarButton,
} from '../test-support/renderWithFlow';

// DownloadMenu → useModeMapExport рендерит карту через html-to-image — в jsdom
// нет canvas/рендерера, мокаем саму библиотеку (как в useModeMapExport.test.ts).
const toPng = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]) => toPng(...args) }));

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  getConceptualization.mockReset();
  getConceptualization.mockResolvedValue(null);
  toPng.mockReset();
});
afterEach(() => cleanup());

describe('ModeMapCanvas — пустая карта', () => {
  it('без узлов показывает подсказку «Карта режимов пуста»', () => {
    renderCanvas({ initialNodes: [] });
    expect(screen.getByText('Карта режимов пуста')).toBeTruthy();
  });

  it('с узлами подсказка не показывается', () => {
    renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    expect(screen.queryByText('Карта режимов пуста')).toBeNull();
  });
});

describe('ModeMapCanvas — история (undo/redo) через тулбар', () => {
  it('«Отменить» недоступна на старте (нет истории) — тултип не найти', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    expect(() => clickToolbarButton(container, 'Отменить (⌘Z)')).toThrow();
  });

  it('удаление узла из контекстного меню включает «Отменить», а отмена восстанавливает узел', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    const nodeEl = screen.getByText('Триггер').closest('.react-flow__node')!;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Удалить'));
    expect(readModel(container).nodes).toHaveLength(0);
    clickToolbarButton(container, 'Отменить (⌘Z)');
    expect(readModel(container).nodes.map((n) => n.id)).toEqual(['n1']);
  });

  it('«Вернуть» повторяет отменённое действие', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    const nodeEl = screen.getByText('Триггер').closest('.react-flow__node')!;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Удалить'));
    clickToolbarButton(container, 'Отменить (⌘Z)');
    expect(readModel(container).nodes).toHaveLength(1);
    clickToolbarButton(container, 'Вернуть (⌘⇧Z)');
    expect(readModel(container).nodes).toHaveLength(0);
  });
});

describe('ModeMapCanvas — авто-расположение', () => {
  it('кнопка отключена, пока карта пуста (тултип недоступен)', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    expect(() =>
      clickToolbarButton(container, 'Разложить автоматически'),
    ).toThrow();
  });

  it('удаление узла отражается в модели, а «Разложить» доступно только когда карта не пуста', () => {
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('a', 'trigger', { label: 'Триггер' }, { x: 0, y: 0 }),
        mmNode('b', 'behavior', { label: 'Поведение' }, { x: 0, y: 0 }),
      ],
      initialEdges: [mmEdge('e1', 'a', 'b')],
    });
    // onAutoLayout планирует setTimeout(50) с fitView — фейковые таймеры не
    // дают ему пережить тест (тот же класс утечки, что у двойного клика).
    vi.useFakeTimers();
    try {
      expect(() =>
        clickToolbarButton(container, 'Разложить автоматически'),
      ).not.toThrow();
      expect(readModel(container).nodes.map((n) => n.id)).toEqual(['a', 'b']);
      vi.runOnlyPendingTimers();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ModeMapCanvas — привязка к сетке и зоны', () => {
  it('«Привязка к сетке» переключает active-состояние (сохраняется в DOM атрибутах кнопки)', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(container, 'Привязка к сетке');
    // ReactFlow получает snapToGrid=true — косвенно проверяем, что клик не падает
    // и повторный клик возвращает обратно без ошибок.
    expect(() =>
      clickToolbarButton(container, 'Привязка к сетке'),
    ).not.toThrow();
  });

  it('kind=problem: включение «Зоны» показывает подписи зон на холсте', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
      kind: 'problem',
    });
    expect(screen.queryByText(/Здоровый Взрослый — над системой/)).toBeNull();
    clickToolbarButton(
      container,
      'Зоны: здоровый взрослый / копинги / детские и критики',
    );
    expect(screen.getByText(/Здоровый Взрослый — над системой/)).toBeTruthy();
  });

  it('kind=couple: рендерит дорожки партнёров вместо зон', () => {
    renderCanvas({ initialNodes: [mmNode('n1', 'trigger')], kind: 'couple' });
    expect(screen.getByText('Партнёр А')).toBeTruthy();
    expect(screen.getByText('Партнёр Б')).toBeTruthy();
  });
});

describe('ModeMapCanvas — легенда и подсказки', () => {
  it('кнопка легенды показывает и снова скрывает панель «Легенда»', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    expect(screen.queryByText('Легенда')).toBeNull();
    clickToolbarButton(container, 'Легенда: формы и цвета');
    expect(screen.getByText('Легенда')).toBeTruthy();
    clickToolbarButton(container, 'Легенда: формы и цвета');
    expect(screen.queryByText('Легенда')).toBeNull();
  });

  it('подсказки (гайд) показаны по умолчанию и скрываются по кнопке', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    expect(screen.getByText('Советы')).toBeTruthy();
    clickToolbarButton(container, 'Подсказки: клиническая цепочка и советы');
    expect(screen.queryByText('Советы')).toBeNull();
  });
});

describe('ModeMapCanvas — шаблоны', () => {
  it('вставка шаблона «Базовый цикл» добавляет его узлы и рёбра на карту', () => {
    // insertGraph тоже планирует setTimeout(50) с fitView — та же утечка.
    vi.useFakeTimers();
    try {
      const { container } = renderCanvas({ initialNodes: [] });
      clickToolbarButton(container, 'Шаблоны и генерация');
      fireEvent.click(screen.getByText('Базовый цикл'));
      const model = readModel(container);
      expect(model.nodes.map((n) => n.label)).toEqual(
        expect.arrayContaining([
          'Триггер',
          'Критик',
          'Уязвимый Ребёнок',
          'Копинг',
          'Поведение',
        ]),
      );
      expect(model.edges).toHaveLength(4);
      vi.runOnlyPendingTimers();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ModeMapCanvas — схемы клиента', () => {
  // Клик по «Схемы клиента» дёргает api.getConceptualization, и обновление
  // списка схем прилетает из-под await, вне act — опрос findByText
  // (timeout 8000) с этим обновлением иногда расходится. clickToolbarButton
  // ищет кнопку по всплывающей подсказке (наведение → проверка текста →
  // уход курсора), и это само по себе синхронная последовательность рендеров:
  // если завернуть весь вызов в act(async), React откладывает их флаш до
  // конца колбэка, и подсказка для queryByText внутри хелпера ещё не
  // существует — кнопка «не находится». Поэтому клик остаётся как есть, а
  // ждём именно то, чего не хватало: `await act(async () => {})` сливает
  // очередь промисов и синхронизирует состояние перед ассертом.
  it('без выбранного узла кнопки схем неактивны и не патчат узел', async () => {
    getConceptualization.mockResolvedValue({ schemaIds: ['abandonment'] });
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(readModel(container).nodes[0]).not.toHaveProperty('schemaId');
  });

  it('с выбранным узлом клик по схеме пишет её в узел (виден бейдж названия схемы)', async () => {
    getConceptualization.mockResolvedValue({ schemaIds: ['abandonment'] });
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    // Бейдж со схемой рисуется прямо в узле (NodeLabel) — видимое следствие патча.
    expect(
      screen.getAllByText('Покинутость / Нестабильность').length,
    ).toBeGreaterThan(0);
  });

  it('пустой список схем клиента — заглушка «нет отмеченных схем»', async () => {
    getConceptualization.mockResolvedValue({ schemaIds: [] });
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(
      screen.getByText('У клиента пока нет отмеченных схем'),
    ).toBeTruthy();
  });

  // Сбой загрузки раньше подставлял пустой список, и панель уверяла терапевта,
  // что у клиента не отмечено ни одной схемы. Это не «пусто», это «неизвестно»:
  // терапевт видит клиническую неправду о своём клиенте и не может отличить её
  // от настоящего пустого списка (CLAUDE.md: никаких заглушек вместо данных).
  it('сбой загрузки схем клиента — говорит «не удалось», а не «схем нет»', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(screen.getByText('Не удалось загрузить схемы клиента')).toBeTruthy();
    expect(screen.queryByText('У клиента пока нет отмеченных схем')).toBeNull();
  });

  it('подсказка без выбранного узла звучит на «ты»/«вы»', async () => {
    getConceptualization.mockResolvedValue({ schemaIds: [] });
    const { container } = renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger')] },
      'ty',
    );
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(screen.getByText('Сначала выбери режим на холсте')).toBeTruthy();
    cleanup();

    getConceptualization.mockResolvedValue({ schemaIds: [] });
    const { container: container2 } = renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger')] },
      'vy',
    );
    clickToolbarButton(
      container2,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(screen.getByText('Сначала выберите режим на холсте')).toBeTruthy();
  });

  it('подсказка с выбранным узлом звучит на «ты»/«вы»', async () => {
    getConceptualization.mockResolvedValue({ schemaIds: [] });
    const { container } = renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })] },
      'ty',
    );
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    clickToolbarButton(
      container,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(
      screen.getByText('Нажми, чтобы привязать к выбранному режиму'),
    ).toBeTruthy();
    cleanup();

    getConceptualization.mockResolvedValue({ schemaIds: [] });
    const { container: container2 } = renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })] },
      'vy',
    );
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    clickToolbarButton(
      container2,
      'Схемы клиента — привязать к выбранному режиму',
    );
    await act(async () => {});
    expect(
      screen.getByText('Нажмите, чтобы привязать к выбранному режиму'),
    ).toBeTruthy();
  });
});

describe('ModeMapCanvas — скачивание карты', () => {
  it('кнопка «Скачать карту» отключена на пустой карте', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    expect(() =>
      clickToolbarButton(container, 'Скачать карту (PNG / PDF)'),
    ).toThrow();
  });

  it('на непустой карте открывает меню PNG/PDF', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(container, 'Скачать карту (PNG / PDF)');
    expect(screen.getByText('Картинка PNG')).toBeTruthy();
    expect(screen.getByText('Документ PDF')).toBeTruthy();
  });

  // Регресс: onExportPng/onExportPdf раньше глушили сбой (`catch { /* ignore */ }`) —
  // рендер карты падал молча, ни файла, ни объяснения (карта режимов, три молчания).
  it('сбой рендера PNG — в меню видна строка «Не удалось подготовить файл», exporting снят', async () => {
    toPng.mockRejectedValue(new Error('canvas boom'));
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(container, 'Скачать карту (PNG / PDF)');
    const pngBtn = screen.getByText('Картинка PNG');
    await act(async () => { fireEvent.click(pngBtn); });
    expect(
      screen.getByText('Не удалось подготовить файл. Попробовать ещё раз'),
    ).toBeTruthy();
    expect((pngBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('успешный экспорт PNG — строки отказа нет', async () => {
    toPng.mockResolvedValue('data:image/png;base64,AAA');
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(container, 'Скачать карту (PNG / PDF)');
    await act(async () => { fireEvent.click(screen.getByText('Картинка PNG')); });
    expect(
      screen.queryByText('Не удалось подготовить файл. Попробовать ещё раз'),
    ).toBeNull();
  });
});

describe('ModeMapCanvas — горячие клавиши (только десктоп)', () => {
  it('на мобильном viewport (matchMedia не совпадает) кнопка горячих клавиш не рендерится', () => {
    renderCanvas({ initialNodes: [mmNode('n1', 'trigger')] });
    expect(screen.queryByText('Горячие клавиши')).toBeNull();
  });

  it('на десктопном viewport показывает список горячих клавиш', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger')],
    });
    clickToolbarButton(container, 'Горячие клавиши');
    expect(screen.getByText('Отменить')).toBeTruthy();
    expect(screen.getByText('Дублировать ноду')).toBeTruthy();
  });
});
