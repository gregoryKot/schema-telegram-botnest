// @vitest-environment jsdom
// Шапка листов схем и режимов: картинка рядом с заголовком или бумага нужного оттенка (docs/design/PAPER_2026-11.md).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SsHead } from './SsHead';

afterEach(cleanup);

describe('SsHead', () => {
  it('layers — слои рядом с заголовком', () => {
    const { container } = render(<SsHead layers title="Мои схемы" />);
    expect(container.querySelector('.pp-head svg.pp-art--row')).toBeTruthy();
  });
  it('cluster — круги рядом с заголовком', () => {
    const { container } = render(<SsHead cluster title="Критик" />);
    expect(container.querySelector('.pp-head svg.pp-art--row')).toBeTruthy();
  });
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
