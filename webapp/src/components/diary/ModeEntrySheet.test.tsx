// @vitest-environment jsdom
// Кризисная детекция в дневнике режимов (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEntrySheet } from './ModeEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

function renderSheetOnFormStep() {
  const utils = render(
    <MemoryRouter>
      <ModeEntrySheet onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />
    </MemoryRouter>,
  );
  // Шаг 1 теперь test-first: список режимов свёрнут. Раскрываем его и
  // выбираем любой режим, чтобы попасть на форму с полями.
  fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
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
    const textarea = screen.getByPlaceholderText('Например: позвонил папа, начал расспрашивать про работу — и я чувствую, что «выключаюсь».');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheetOnFormStep();
    const textarea = screen.getByPlaceholderText('Например: позвонил папа, начал расспрашивать про работу — и я чувствую, что «выключаюсь».');
    fireEvent.change(textarea, { target: { value: 'Обычный звонок с папой' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// В7 дизайн-аудита 2026-08: поле связано с видимым вопросом (aria-labelledby),
// не только с исчезающим при вводе placeholder.
describe('ModeEntrySheet — поле связано с вопросом (В7)', () => {
  it('textarea доступно по видимому вопросу шага', () => {
    renderSheetOnFormStep();
    const byLabel = screen.getByLabelText('Что произошло?');
    const byPlaceholder = screen.getByPlaceholderText('Например: позвонил папа, начал расспрашивать про работу — и я чувствую, что «выключаюсь».');
    expect(byLabel).toBe(byPlaceholder);
  });
});
