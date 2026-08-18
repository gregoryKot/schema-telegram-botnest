// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник схем — эталон паттерна детекции
// (detectCrisisAny по всем свободнотекстовым полям + CrisisCard). С визардом
// (парный слайс к «Дневнику режимов», PR #187+) шаг «ситуация» — первый экран,
// поэтому кризисный текст проверяем прямо на нём.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaEntrySheet } from './SchemaEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderSheet() {
  render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
  return screen.getByPlaceholderText(/на созвоне А\. сказал, что мой ппт/);
}

describe('SchemaEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в любом свободном поле', () => {
    const trigger = renderSheet();
    fireEvent.change(trigger, { target: { value: 'не хочу жить' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const trigger = renderSheet();
    fireEvent.change(trigger, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});

describe('SchemaEntrySheet — визард (шаги переключаются, обязательность, сохранение)', () => {
  it('шаг «Что случилось?» обязателен — «Далее» задизейблено, пока пусто', () => {
    render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
    const nextBtn = screen
      .getByText('Далее →')
      .closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    const trigger = screen.getByPlaceholderText(
      /на созвоне А\. сказал, что мой ппт/,
    );
    fireEvent.change(trigger, { target: { value: 'Созвон с командой' } });
    expect(nextBtn.disabled).toBe(false);
  });

  it('клик по сегменту прогресса переключает шаг (например, на «Чувства»)', () => {
    render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
    const segments = screen.getAllByRole('button', { name: '' });
    // Второй прогресс-сегмент — шаг «Чувства».
    fireEvent.click(segments[1]);
    expect(screen.getByText('Чувства')).toBeTruthy();
  });

  it('можно выбрать эмоцию на шаге «Чувства» и увидеть шкалу интенсивности', () => {
    render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
    const segments = screen.getAllByRole('button', { name: '' });
    fireEvent.click(segments[1]);
    fireEvent.click(screen.getByText(/Страх/));
    expect(screen.getByText('заметно')).toBeTruthy();
  });

  it('можно выбрать схему на шаге «Схемы»', () => {
    render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
    const segments = screen.getAllByRole('button', { name: '' });
    fireEvent.click(segments[5]);
    expect(screen.getByText('Схемы')).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/так папа в детстве оценивал/),
    ).toBeTruthy();
  });

  it('сохранение доступно уже с первого шага, заполнив только ситуацию', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SchemaEntrySheet onClose={() => {}} onSave={onSave} />);
    const trigger = screen.getByPlaceholderText(
      /на созвоне А\. сказал, что мой ппт/,
    );
    fireEvent.change(trigger, { target: { value: 'Созвон с командой' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'Созвон с командой',
        emotions: [],
        schemaIds: [],
      }),
    );
  });
});
