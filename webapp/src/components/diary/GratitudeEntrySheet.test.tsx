// @vitest-environment jsdom
// Кризисная детекция в дневнике благодарности (CLAUDE.md, правило №7):
// detectCrisisAny(...items) — проверка по всем пунктам, а не только по первому.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

function renderSheet() {
  return render(
    <MemoryRouter>
      <GratitudeEntrySheet onClose={vi.fn()} date="2026-07-20" onSave={vi.fn().mockResolvedValue(undefined)} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('GratitudeEntrySheet — кризисная детекция', () => {
  it('кризисная фраза в одном из пунктов показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня…');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня…');
    fireEvent.change(textarea, { target: { value: 'Тёплый чай вечером' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
