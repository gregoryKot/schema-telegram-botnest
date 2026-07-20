// @vitest-environment jsdom
// Кризисная детекция в дневнике режимов (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEntrySheet } from './ModeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

function renderSheetOnFormStep() {
  const utils = render(
    <MemoryRouter>
      <ModeEntrySheet onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />
    </MemoryRouter>,
  );
  // Пикер режима — выбираем любой, чтобы попасть на форму с полями.
  fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
  return utils;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ModeEntrySheet — кризисная детекция', () => {
  it('кризисная фраза в описании ситуации показывает CrisisCard', () => {
    renderSheetOnFormStep();
    const textarea = screen.getByPlaceholderText('Папа позвонил, начал спрашивать про работу. Почувствовал как «отключился»…');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheetOnFormStep();
    const textarea = screen.getByPlaceholderText('Папа позвонил, начал спрашивать про работу. Почувствовал как «отключился»…');
    fireEvent.change(textarea, { target: { value: 'Обычный звонок с папой' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
