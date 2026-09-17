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
  // Клик и ожидание результата разведены намеренно: `onGenerateFromConcept`
  // асинхронный (await api.getConceptualization), и обновление состояния
  // прилетает уже из-под await — то есть вне act. Раньше тест ждал появления
  // текста опросом (`findByText`, timeout 8000) и в CI один раз честно
  // прождал все 8 секунд впустую: опрос идёт внутри своего act, а обновление
  // лежит в act-очереди — слив очереди и опрос могут разойтись. Поэтому
  // ждём не «когда-нибудь появится», а ровно то, чего ждём: `act(async)`
  // дожидается промиса api и сливает очередь. После него состояние финальное,
  // и ассерт синхронный — гонке негде поместиться.
  const clickGenerate = () =>
    act(async () => {
      fireEvent.click(screen.getByText('Из концептуализации клиента'));
    });

  it('добавляет узлы для режимов клиента, которых ещё нет на карте', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'] });
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    await clickGenerate();

    expect(readModel(container).nodes.map((n) => n.label)).toContain(
      'Уязвимый Ребёнок',
    );
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    // После добавления узла код планирует setTimeout(60) для повторного авто-layout —
    // дожидаемся его здесь же, чтобы он не выстрелил уже в другом тестовом файле.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 90));
    });
  });

  it('режим, уже вынесенный на карту, не дублируется — остальные добавляются', async () => {
    // Раньше тест брал один режим, уже лежащий на карте, ждал `Promise.resolve()`
    // и проверял «узлов по-прежнему один». Такой ассерт проходит и когда
    // генерация вообще не отработала — то есть о дедупликации не говорит ничего.
    // Теперь в концептуализации два режима: один на карте, второй нет. Дубля
    // не появилось И второй доехал — только вместе это про дедупликацию.
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

    const labels = readModel(container).nodes.map((n) => n.label);
    expect(labels).toEqual(['Уязвимый Ребёнок', 'Отстранённый Защитник']);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 90));
    });
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
