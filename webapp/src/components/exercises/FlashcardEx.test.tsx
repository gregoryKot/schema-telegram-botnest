// @vitest-environment jsdom
// Кризисная детекция в FlashcardEx (CLAUDE.md, правило №7). FlashcardFlow —
// общий внутренний компонент SchemaEx/ModeEx (FlashcardEx.tsx), проверяем
// через SchemaEx с initialSchemaId — сразу попадаем на первый вопрос.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEx } from './FlashcardEx';

vi.mock('../../api', () => ({
  api: {
    saveSchemaNote: vi.fn().mockResolvedValue(undefined),
    saveModeNote: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));

function renderSheet() {
  return render(
    <MemoryRouter>
      <SchemaEx onBack={vi.fn()} initialSchemaId="emotional_deprivation" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('FlashcardEx (SchemaEx) — кризисная детекция', () => {
  it('кризисная фраза в ответе показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Обычно это молчание в переписке' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
