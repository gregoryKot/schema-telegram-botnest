// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { markSheetOpen, useAnySheetOpen } from './openSheets';
import { useHistorySheet } from './useHistorySheet';

function Probe() {
  return <span data-testid="s">{useAnySheetOpen() ? 'open' : 'closed'}</span>;
}
function Sheet() {
  useHistorySheet(() => {});
  return <div>sheet</div>;
}

describe('реестр открытых листов', () => {
  it('открытых нет — closed; отметка включает, снятие выключает', () => {
    render(<Probe />);
    expect(screen.getByTestId('s').textContent).toBe('closed');
    let unmark = () => {};
    act(() => { unmark = markSheetOpen('a'); });
    expect(screen.getByTestId('s').textContent).toBe('open');
    act(() => unmark());
    expect(screen.getByTestId('s').textContent).toBe('closed');
  });

  it('два листа: закрыт один — всё ещё open, закрыты оба — closed', () => {
    render(<Probe />);
    let u1 = () => {}; let u2 = () => {};
    act(() => { u1 = markSheetOpen('a'); u2 = markSheetOpen('b'); });
    act(() => u1());
    expect(screen.getByTestId('s').textContent).toBe('open');
    act(() => u2());
    expect(screen.getByTestId('s').textContent).toBe('closed');
  });

  it('любой компонент с useHistorySheet попадает в реестр сам, без списка', () => {
    const { rerender } = render(<MemoryRouter><Probe />{<Sheet />}</MemoryRouter>);
    expect(screen.getByTestId('s').textContent).toBe('open');
    rerender(<MemoryRouter><Probe /></MemoryRouter>);
    expect(screen.getByTestId('s').textContent).toBe('closed');
  });
});
