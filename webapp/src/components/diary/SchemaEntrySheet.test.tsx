// @vitest-environment jsdom
// Кризисная детекция в дневнике схем (CLAUDE.md, правило №7) — эталонный
// компонент, на который ориентировались остальные 5 (см. CrisisCard.test.tsx,
// NoteSheet.test.tsx и др.). Проверяем основное поле "trigger".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEntrySheet } from './SchemaEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

function renderSheet() {
  return render(
    <MemoryRouter>
      <SchemaEntrySheet onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />
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

describe('SchemaEntrySheet — кризисная детекция', () => {
  it('кризисная фраза в описании ситуации показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: на созвоне А. сказал что мой ппт «слабо проработан»…');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: на созвоне А. сказал что мой ппт «слабо проработан»…');
    fireEvent.change(textarea, { target: { value: 'Обычный рабочий созвон' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
