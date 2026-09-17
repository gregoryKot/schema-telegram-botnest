// @vitest-environment jsdom
// ModeMapEdgeEditor — панель редактирования связи между нодами карты режимов
// (тот же файл, что и ModeMapNodeEditor — см. соседний тест). Чистая форма,
// @xyflow/react не нужен.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeMapEdgeEditor } from './ModeMapNodeEditor';
import type { ModeMapEdge } from '../api';

function baseEdge(overrides: Partial<ModeMapEdge> = {}): ModeMapEdge {
  return { id: 'e1', source: 'n1', target: 'n2', ...overrides };
}

function renderEditor(edge: ModeMapEdge) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const onSwap = vi.fn();
  const onClose = vi.fn();
  render(<ModeMapEdgeEditor edge={edge} onChange={onChange} onDelete={onDelete} onSwap={onSwap} onClose={onClose} />);
  return { onChange, onDelete, onSwap, onClose };
}

beforeEach(() => {
  // Выбор подписи из шаблонов случайный (shuffle) — фиксируем ГСЧ, чтобы
  // список подсказок был детерминирован между прогонами теста.
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ModeMapEdgeEditor — тип связи и подпись', () => {
  it('выбор типа «защищает от» пишет edgeType и подставляет подпись из подсказок', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByText('защищает от'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ edgeType: 'protects' }),
      label: expect.any(String),
    }));
  });

  it('ручной ввод подписи пишет label напрямую', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.change(screen.getByLabelText('Подпись (необязательно)'), { target: { value: 'будит критика' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'будит критика' }));
  });

  it('пустая подпись пишет undefined, а не пустую строку', () => {
    const { onChange } = renderEditor(baseEdge({ label: 'было' }));
    fireEvent.change(screen.getByLabelText('Подпись (необязательно)'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: undefined }));
  });

  it('клик по варианту подписи из подсказок ставит его как label', () => {
    const { onChange } = renderEditor(baseEdge({ data: { edgeType: 'activates' } }));
    const suggestion = screen.getAllByRole('button').find(b =>
      ['активирует', 'запускает', 'будит', 'включает', 'провоцирует', 'пробуждает', 'цепляет', 'триггерит'].includes(b.textContent ?? ''),
    );
    expect(suggestion).toBeTruthy();
    fireEvent.click(suggestion!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: suggestion!.textContent }));
  });
});

describe('ModeMapEdgeEditor — стиль, толщина, направление, цвет', () => {
  it('стиль линии «Пунктир» пишет lineStyle=dashed', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Пунктир'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lineStyle: 'dashed' }) }));
  });

  it('толщина «Жирная» пишет width=bold', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Жирная'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ width: 'bold' }) }));
  });

  it('«Две стрелки» пишет bidirectional=true', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Две стрелки'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidirectional: true }) }));
  });

  it('«Развернуть» вызывает onSwap, а не onChange напрямую', () => {
    const { onSwap, onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Развернуть (поменять начало и конец)'));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('цветовой пресет пишет color, «Нейтральный» сбрасывает в undefined', () => {
    const { onChange } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Оливковый'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ color: 'var(--c-moss)' }) }));
    fireEvent.click(screen.getByLabelText('Нейтральный (по умолчанию)'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ color: undefined }) }));
  });
});

describe('ModeMapEdgeEditor — удаление и закрытие', () => {
  it('«Удалить связь» вызывает onDelete', () => {
    const { onDelete } = renderEditor(baseEdge());
    fireEvent.click(screen.getByText('Удалить связь'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('кнопка «Закрыть» вызывает onClose', () => {
    const { onClose } = renderEditor(baseEdge());
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
