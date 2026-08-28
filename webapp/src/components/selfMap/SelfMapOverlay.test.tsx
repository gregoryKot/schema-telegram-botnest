// @vitest-environment jsdom
// Точка монтирования карты себя: скелетон по форме, пока данные не готовы
// (правило CLAUDE.md — силуэт, не спиннер), и завязка на useHistorySheet
// (fixed-оверлей обязан использовать хук, иначе «Назад» браузера уводит из
// приложения).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SelfMapOverlay } from './SelfMapOverlay';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn().mockReturnValue(new Promise(() => {})),
    getModeNotes: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn().mockResolvedValue({ ysq: { completedAt: null } }),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderOverlay(over = {}) {
  const props = {
    onClose: vi.fn(),
    onStartCase: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenSchema: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <SelfMapOverlay {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('SelfMapOverlay', () => {
  it('падает без MemoryRouter — завязан на useHistorySheet', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SelfMapOverlay
          onClose={vi.fn()}
          onStartCase={vi.fn()}
          onOpenTracker={vi.fn()}
          onOpenSchema={vi.fn()}
        />,
      ),
    ).toThrow();
    spy.mockRestore();
  });

  it('пока данные не готовы — скелетон, а не пустая карта и не спиннер-текст', () => {
    renderOverlay();
    expect(screen.getAllByText('Карта себя').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Черновик/)).toBeNull();
  });

  it('когда данные готовы — показывает саму карту', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderOverlay();
    await waitFor(() => expect(screen.getByText(/Черновик/)).toBeTruthy());
  });
});
