// @vitest-environment jsdom
// Фигуры схемы случая на настоящем холсте (тот же харнесс, что у ModeMapNodes):
// что видно на фигуре, чего нет (таблетка схемы), размеры круга потребностей.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderCanvas, mmNode } from '../ModeMapCanvas.test-helpers';
import { installFlowTestPolyfills } from '../../test-support/renderWithFlow';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
});
afterEach(() => cleanup());

const PILL = 'Покинутость / Нестабильность'; // название схемы abandonment — то, что рисует таблетка схемы

describe('ConceptNodes — схема и опыт', () => {
  it('схема: название и убеждение на фигуре, таблетки схемы под текстом нет', () => {
    renderCanvas({
      initialNodes: [mmNode('s', 'schema', { label: 'Схема Покинутость', note: 'Меня всегда оставляют', schemaId: 'abandonment' })],
    });
    expect(screen.getByText('Схема Покинутость')).toBeTruthy();
    expect(screen.getByText('Меня всегда оставляют')).toBeTruthy();
    expect(screen.queryByText(PILL)).toBeNull();
  });

  it('обычный режим с той же схемой по-прежнему показывает таблетку (hideSchema только у схемы случая)', () => {
    renderCanvas({
      initialNodes: [mmNode('c', 'child', { label: 'Ребёнок', note: 'прячется', schemaId: 'abandonment' })],
    });
    expect(screen.getByText(PILL)).toBeTruthy();
  });

  it('опыт: подпись и текст, без таблетки схемы; мягкое пятно с органичным радиусом', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('o', 'origin', { label: 'Как нарушалась потребность', note: 'Мама часто уезжала', schemaId: 'abandonment' })],
    });
    expect(screen.getByText('Как нарушалась потребность')).toBeTruthy();
    expect(screen.getByText('Мама часто уезжала')).toBeTruthy();
    expect(screen.queryByText(PILL)).toBeNull();
    const blob = screen.getByText('Мама часто уезжала').closest('div[style*="border-radius"]') as HTMLElement;
    expect(blob.style.borderRadius).toContain('/');
    expect(container.querySelector('.react-flow__node-origin')).toBeTruthy();
  });

  it('display=name прячет текст и у фигур схемы случая', () => {
    renderCanvas({
      initialNodes: [mmNode('s', 'schema', { label: 'Схема Покинутость', note: 'Меня всегда оставляют', display: 'name' })],
    });
    expect(screen.queryByText('Меня всегда оставляют')).toBeNull();
  });
});

describe('ConceptNodes — потребность и круг', () => {
  it('потребность — таблетка с названием', () => {
    renderCanvas({ initialNodes: [mmNode('n', 'need', { label: 'Привязанность', needId: 'attachment' })] });
    const pill = screen.getByText('Привязанность').closest('div[style*="border-radius"]') as HTMLElement;
    expect(pill.style.borderRadius).toBe('9999px');
  });

  it('круг: подпись внутри, размер по умолчанию 340, круглая заливка', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('h', 'needs', { label: 'Базовые эмоциональные потребности' })],
    });
    expect(screen.getByText('Базовые эмоциональные потребности')).toBeTruthy();
    const hub = container.querySelector('.react-flow__node-needs > div') as HTMLElement;
    expect(hub.style.width).toBe('340px');
    expect(hub.style.height).toBe('340px');
    const disc = screen.getByText('Базовые эмоциональные потребности').closest('div[style*="border-radius: 50%"]') as HTMLElement;
    expect(disc).toBeTruthy();
  });

  it('круг берёт диаметр из data.diameter', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('h', 'needs', { label: 'Круг', diameter: 220 })],
    });
    const hub = container.querySelector('.react-flow__node-needs > div') as HTMLElement;
    expect(hub.style.width).toBe('220px');
  });

  it('у круга есть ручки соединения, как у остальных фигур', () => {
    const { container } = renderCanvas({ initialNodes: [mmNode('h', 'needs', { label: 'Круг' })] });
    expect(container.querySelectorAll('.react-flow__node-needs .mm-handle').length).toBeGreaterThanOrEqual(4);
  });
});
