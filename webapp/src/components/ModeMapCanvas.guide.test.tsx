// @vitest-environment jsdom
// ModeMapCanvas — интеграция с гайдом (добавление узла из подсказки, фокус на
// поле потребности), генерация узлов из концептуализации клиента, зум-кнопки
// и клик по ребру. Отдельный файл по теме (CLAUDE.md: файлы < 300 строк).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  renderCanvas,
  mmNode,
  readModel,
  getConceptualization,
} from './ModeMapCanvas.test-helpers';
import {
  installFlowTestPolyfills,
  clickToolbarButton,
} from '../test-support/renderWithFlow';
import { RICH } from '../../../shared/src/therapy/conceptGraph/diagram/diagram.test-helpers';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  getConceptualization.mockReset();
  getConceptualization.mockResolvedValue(null);
});
afterEach(() => cleanup());

describe('ModeMapCanvas — добавление узла из подсказок (гайда)', () => {
  it('клик по невыполненному шагу гайда добавляет соответствующий узел на карту', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    expect(readModel(container).nodes).toHaveLength(0);
    fireEvent.click(screen.getByText('1. Триггер').closest('button')!);
    const model = readModel(container);
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].type).toBe('trigger');
  });

  it('шаг «Потребность» доступен только когда на карте уже есть Уязвимый Ребёнок, и выбирает его', () => {
    // onOpenNeed планирует window.dispatchEvent через setTimeout(40) — фейковые
    // таймеры не дают ему пережить тест (см. комментарий в interactions-тесте
    // на двойной клик, тот же класс утечки).
    vi.useFakeTimers();
    try {
      const { container } = renderCanvas({
        initialNodes: [mmNode('n1', 'child', { label: 'Уязвимый Ребёнок' })],
      });
      const needBtn = screen
        .getByText('6. Потребность')
        .closest('button') as HTMLButtonElement;
      expect(needBtn.disabled).toBe(false);
      fireEvent.click(needBtn);
      expect(
        container.querySelector('[data-testid="mm-debug-selected"]')!
          .textContent,
      ).toBe('n1');
      vi.runOnlyPendingTimers();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ModeMapCanvas — генерация из концептуализации клиента', () => {
  // Клик и ожидание результата разведены намеренно: `generate` асинхронный
  // (await api.getConceptualization), и обновление состояния прилетает уже
  // из-под await — то есть вне act. Раньше тест ждал появления текста опросом
  // (`findByText`, timeout 8000) и в CI один раз честно прождал все 8 секунд
  // впустую: опрос идёт внутри своего act, а обновление лежит в act-очереди —
  // слив очереди и опрос могут разойтись. Поэтому ждём не «когда-нибудь
  // появится», а ровно то, чего ждём: `act(async)` дожидается промиса api и
  // сливает очередь. После него состояние финальное, и ассерт синхронный —
  // гонке негде поместиться.
  const clickGenerate = () =>
    act(async () => {
      fireEvent.click(screen.getByText('Из концептуализации клиента'));
    });
  // insertGraph планирует setTimeout(50) на подгон масштаба — дожидаемся его
  // здесь же, чтобы он не выстрелил уже в другом тестовом файле.
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 90));
    });
  const types = (c: HTMLElement) => readModel(c).nodes.map((n) => n.type);
  const modeIds = (c: HTMLElement) =>
    readModel(c)
      .nodes.map((n) => n.data?.modeId)
      .filter(Boolean);
  const FULL = {
    modeIds: RICH.modeIds,
    schemaIds: RICH.schemaIds,
    modeLinks: RICH.modeLinks,
    schemaLinks: RICH.schemaLinks,
  };

  it('добавляет режимы клиента и вместе с ними круг потребностей', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'] });
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();

    expect(readModel(container).nodes.map((n) => n.label)).toContain(
      'Уязвимый Ребёнок',
    );
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(types(container).filter((t) => t === 'needs')).toHaveLength(1);
    expect(types(container).filter((t) => t === 'need')).toHaveLength(5);
    await settle();
  });

  it('схемы, опыт, потребности и линии ✗ / ✓ едут на карту, а не только режимы', async () => {
    getConceptualization.mockResolvedValue(FULL);
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();

    const t = types(container);
    expect(t.filter((x) => x === 'schema')).toHaveLength(2);
    expect(t.filter((x) => x === 'origin')).toHaveLength(2);
    expect(t.filter((x) => x === 'healthy')).toHaveLength(1);
    // 4 связи режим⇄схема + 2 опыта + 4 ✗ + 3 ✓
    expect(readModel(container).edges).toHaveLength(13);
    await settle();
  });

  it('режим, уже вынесенный на карту, не дублируется — остальные добавляются', async () => {
    // Два режима в концептуализации: один на карте, второй нет. Дубля не
    // появилось И второй доехал — только вместе это про дедупликацию.
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'detached_protector'],
    });
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('n1', 'child', {
          modeId: 'vulnerable_child',
          label: 'Уязвимый Ребёнок',
        }),
      ],
    });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();

    expect(modeIds(container)).toEqual([
      'vulnerable_child',
      'detached_protector',
    ]);
    await settle();
  });

  it('второй запуск подряд ничего не дублирует: ни нод, ни рёбер', async () => {
    getConceptualization.mockResolvedValue(FULL);
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();
    const first = readModel(container);
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();
    const second = readModel(container);

    expect(second.nodes).toHaveLength(first.nodes.length);
    expect(second.edges).toHaveLength(first.edges.length);
    await settle();
  });

  it('отказ загрузки виден терапевту и ничего не добавляет', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();

    expect(screen.getByRole('alert').textContent).toContain(
      'Не получилось собрать схему из концептуализации',
    );
    expect(readModel(container).nodes).toHaveLength(0);
  });
});

describe('ModeMapCanvas — зум и обзор', () => {
  it('кнопки «Отдалить» / «Приблизить» / «Показать всё» не роняют холст', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    expect(() => clickToolbarButton(container, 'Отдалить')).not.toThrow();
    expect(() => clickToolbarButton(container, 'Приблизить')).not.toThrow();
    expect(() => clickToolbarButton(container, 'Показать всё')).not.toThrow();
  });
});

describe('ModeMapCanvas — экспорт (клики не роняют холст)', () => {
  it('клик по «Картинка PNG» / «Документ PDF» не бросает ошибку синхронно', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    clickToolbarButton(container, 'Скачать карту (PNG / PDF)');
    expect(() =>
      fireEvent.click(screen.getByText('Картинка PNG')),
    ).not.toThrow();
  });
});

describe('ModeMapCanvas — подсказки не висят всегда', () => {
  const nodes = (n: number) => Array.from({ length: n }, (_, i) => mmNode(`n${i}`, 'trigger', { label: `Триггер ${i}` }));
  const guideOpen = () => screen.queryByText('1. Триггер') !== null;

  it('без сохранённого выбора на карте из 3+ узлов подсказки закрыты', () => {
    renderCanvas({ initialNodes: nodes(3) });
    expect(guideOpen()).toBe(false);
  });

  it('без сохранённого выбора на карте меньше 3 узлов подсказки открыты', () => {
    renderCanvas({ initialNodes: nodes(2) });
    expect(guideOpen()).toBe(true);
  });

  it('сохранённое «1» держит подсказки открытыми даже на большой карте', () => {
    localStorage.setItem('modemap_guide', '1');
    renderCanvas({ initialNodes: nodes(5) });
    expect(guideOpen()).toBe(true);
  });

  it('сохранённое «0» держит подсказки закрытыми даже на пустой карте', () => {
    localStorage.setItem('modemap_guide', '0');
    renderCanvas({ initialNodes: [] });
    expect(guideOpen()).toBe(false);
  });

  it('третий узел, добавленный при открытых подсказках, их не закрывает', () => {
    const { container } = renderCanvas({ initialNodes: nodes(2) });
    fireEvent.click(screen.getByText('2. Уязвимый Ребёнок').closest('button')!);
    expect(readModel(container).nodes).toHaveLength(3);
    expect(guideOpen()).toBe(true);
  });
});
