// @vitest-environment jsdom
// Кризисная детекция в дневнике благодарности (CLAUDE.md, правило №7):
// detectCrisisAny(...items) — проверка по всем пунктам, а не только по первому.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

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
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня…');
    fireEvent.change(textarea, { target: { value: 'Тёплый чай вечером' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// В7 дизайн-аудита 2026-08: каждый пункт связан со своим вопросом через
// aria-label, а не только через исчезающий при вводе placeholder.
describe('GratitudeEntrySheet — поля связаны с вопросом (В7)', () => {
  it('каждое поле доступно по своему вопросу как по label', () => {
    renderSheet();
    const first = screen.getByLabelText(/Пункт 1: Что-то хорошее/);
    const second = screen.getByLabelText(/Пункт 2: Кто-то, кто помог/);
    expect(first).toBe(
      screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня…'),
    );
    expect(second).toBe(
      screen.getByPlaceholderText('Кто-то, кто помог или поддержал…'),
    );
  });
});
