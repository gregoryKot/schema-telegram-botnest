// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SelfMapLink } from './SelfMapLink';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../components/caseFlow/CaseFlowHost', () => ({
  CaseFlowHost: ({ start }: { start: string }) => <div data-testid="host">{start}</div>,
}));

afterEach(cleanup);

describe('SelfMapLink', () => {
  it('тап открывает карту себя, до него хоста нет', () => {
    render(<SelfMapLink onOpenTracker={vi.fn()} onOpenSchema={vi.fn()} />);
    expect(screen.queryByTestId('host')).toBeNull();
    fireEvent.click(screen.getByText(/Где это на карте себя/));
    expect(screen.getByTestId('host').textContent).toBe('map');
  });
});
