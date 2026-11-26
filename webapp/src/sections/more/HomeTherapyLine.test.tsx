// @vitest-environment jsdom
// Строка «самопомощь, не замена терапии» внизу «Ещё». До 2026-11-06 она слала
// место home, и /stats приписывал её показы главной («Мост к терапевту»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomeTherapyLine } from './HomeTherapyLine';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../components/therapy/trackTherapyNudge', () => ({ trackTherapyNudge: track }));

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('HomeTherapyLine', () => {
  it('показ уходит с местом more_bottom, а не home', () => {
    render(<MemoryRouter><HomeTherapyLine /></MemoryRouter>);
    expect(track).toHaveBeenCalledWith('more_bottom', 'shown');
    expect(track).not.toHaveBeenCalledWith('home', expect.anything());
  });
});
