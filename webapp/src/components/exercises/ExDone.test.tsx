// @vitest-environment jsdom
// Экран «готово» упражнений: шалфейная бумага с листком над содержимым (docs/design/PAPER_2026-11.md).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExDone } from './ExScreen';
import { SsHead } from '../schemaSheets/SsHead';

afterEach(cleanup);

describe('ExDone', () => {
  it('pp-paper с листком первым ребёнком, содержимое на месте', () => {
    const { container } = render(<ExDone className="ex2-scene"><p>Сохранено</p></ExDone>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pp-paper');
    expect(root.className).toContain('ex2-scene');
    expect(root.style.getPropertyValue('--h')).toBe('135');
    expect(root.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('Сохранено')).toBeTruthy();
  });
});

describe('SsHead', () => {
  it('paperHue — бумага нужного оттенка, слои над заголовком', () => {
    const { container } = render(<SsHead paperHue={70} title="Результат" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pp-paper');
    expect(root.style.getPropertyValue('--h')).toBe('70');
    expect(root.querySelector('svg.pp-art--square')).toBeTruthy();
  });
  it('без пропсов картинки нет', () => {
    const { container } = render(<SsHead title="Режим" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
