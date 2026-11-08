// @vitest-environment jsdom
// ZoomBar — группа масштаба внизу слева: процент — текущий зум холста, клик по
// нему возвращает 100%, «Показать всё» зовёт подгонку с учётом панелей.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ReactFlow } from '@xyflow/react';
import { ZoomBar } from './ZoomBar';
import { installFlowTestPolyfills, renderWithFlow } from '../../test-support/renderWithFlow';

beforeEach(() => installFlowTestPolyfills());
afterEach(() => cleanup());

function renderBar(onFit = vi.fn()) {
  renderWithFlow(<ReactFlow nodes={[]} edges={[]}><ZoomBar onFit={onFit} /></ReactFlow>);
  return { onFit, pct: () => screen.getByTitle('Масштаб 100%') };
}

describe('ZoomBar', () => {
  it('показывает текущий масштаб в процентах', () => {
    const { pct } = renderBar();
    expect(pct().textContent).toBe('100%');
  });

  it('«Приблизить» и «Отдалить» меняют процент, клик по проценту возвращает 100%', async () => {
    const { pct } = renderBar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Приблизить' })); });
    expect(pct().textContent).toBe('120%');
    await act(async () => { fireEvent.click(pct()); });
    expect(pct().textContent).toBe('100%');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Отдалить' })); });
    expect(pct().textContent).toBe('83%');
  });

  it('у процента есть имя для скринридера с текущим масштабом', () => {
    renderBar();
    expect(screen.getByRole('button', { name: 'Масштаб 100%, вернуть 100%' })).toBeTruthy();
  });

  it('«Показать всё» зовёт подгонку холста', () => {
    const { onFit } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Показать всё' }));
    expect(onFit).toHaveBeenCalledTimes(1);
  });
});
