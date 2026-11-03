// @vitest-environment jsdom
// useAnyDialogOpen — признак «открыт хоть один диалог» для уведомлений, которые
// не должны лежать поверх модального шага (баннер куки сайта, QA 2026-11).
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useAnyDialogOpen } from './dialogStack';
import { useDialogA11y } from './dialogA11y';

afterEach(cleanup);

function Modal() {
  const a11y = useDialogA11y();
  return <div {...a11y}>окно</div>;
}

function Probe() {
  return <span data-testid="probe">{useAnyDialogOpen() ? 'open' : 'closed'}</span>;
}

describe('useAnyDialogOpen', () => {
  it('диалог открыт — true; оба закрыты — снова false', () => {
    const { rerender } = render(<><Probe /></>);
    expect(screen.getByTestId('probe').textContent).toBe('closed');
    rerender(<><Modal /><Modal /><Probe /></>);
    expect(screen.getByTestId('probe').textContent).toBe('open');
    rerender(<><Modal /><Probe /></>);
    expect(screen.getByTestId('probe').textContent).toBe('open');
    rerender(<><Probe /></>);
    expect(screen.getByTestId('probe').textContent).toBe('closed');
  });
});
