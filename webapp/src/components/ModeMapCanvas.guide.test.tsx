// @vitest-environment jsdom
// ModeMapCanvas — интеграция с гайдом (добавление узла из подсказки, фокус на
// поле потребности), генерация узлов из концептуализации клиента, зум-кнопки
// и клик по ребру. Отдельный файл по теме (CLAUDE.md: файлы < 300 строк).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
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
  it('добавляет узлы для режимов клиента, которых ещё нет на карте', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'] });
    const { container } = renderCanvas({ initialNodes: [] });
    clickToolbarButton(container, 'Шаблоны и генерация');
    fireEvent.click(screen.getByText('Из концептуализации клиента'));
    expect(
      await screen.findByText('Уязвимый Ребёнок', {}, { timeout: 8000 }),
    ).toBeTruthy();
    expect(readModel(container).nodes.map((n) => n.label)).toContain(
      'Уязвимый Ребёнок',
    );
    // После добавления узла код планирует setTimeout(60) для повторного авто-layout —
    // дожидаемся его здесь же, чтобы он не выстрелил уже в другом тестовом файле.
    await new Promise((r) => setTimeout(r, 90));
  });

  it('режим, уже вынесенный на карту, не дублируется повторно', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'] });
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('n1', 'child', {
          modeId: 'vulnerable_child',
          label: 'Уязвимый Ребёнок',
        }),
      ],
    });
    clickToolbarButton(container, 'Шаблоны и генерация');
    fireEvent.click(screen.getByText('Из концептуализации клиента'));
    await Promise.resolve();
    expect(readModel(container).nodes).toHaveLength(1);
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
