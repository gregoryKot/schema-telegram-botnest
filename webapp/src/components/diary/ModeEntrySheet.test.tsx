// @vitest-environment jsdom
// Кризисная детекция в дневнике режимов (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEntrySheet } from './ModeEntrySheet';
import { describeCrisisField } from '../../test-support/crisisCardHarness';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';

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

describeCrisisField('webapp/src/components/diary/ModeEntryForm.tsx', {
  label: 'что произошло',
  open: renderSheetOnFormStep,
  enter: (text) =>
    fireEvent.change(
      screen.getByPlaceholderText('Например: позвонил папа, начал расспрашивать про работу — и я чувствую, что «выключаюсь».'),
      { target: { value: text } },
    ),
});

// Последний шаг — ответ Здорового Взрослого, своё поле и своё состояние.
describeCrisisField('webapp/src/components/diary/ModeEntryForm.tsx', {
  label: 'ответ Здорового Взрослого',
  open: () => {
    renderSheetOnFormStep();
    const ticks = screen.getAllByRole('button', { name: /^Шаг \d+$/ });
    fireEvent.click(ticks[ticks.length - 1]);
  },
  enter: (text) => fireEvent.change(screen.getByPlaceholderText('Напиши своими словами…'), { target: { value: text } }),
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

// QA 2026-11, М5: пример Здорового Взрослого показывался в двойных кавычках
// ««Мне сейчас больно…»» — экран добавлял свои «» к тексту карточки.
describe('ModeEntrySheet — пример Здорового Взрослого', () => {
  it('одна пара кавычек: текст карточки как есть', () => {
    renderSheetOnFormStep();
    const ticks = screen.getAllByRole('button', { name: /^Шаг \d+$/ });
    fireEvent.click(ticks[ticks.length - 1]);
    const example = screen.getByText(/^«Мне сейчас больно/);
    expect(example.textContent).toBe(healthyAdultHint('vulnerable_child'));
    expect(example.textContent).not.toMatch(/««|»»/);
  });
});
