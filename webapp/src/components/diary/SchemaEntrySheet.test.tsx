// @vitest-environment jsdom
// Кризисная детекция в дневнике схем (CLAUDE.md, правило №7) — эталонный
// компонент, на который ориентировались остальные 5 (см. CrisisCard.test.tsx,
// NoteSheet.test.tsx и др.). Проверяем основное поле "trigger".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEntrySheet } from './SchemaEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

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
    const textarea = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…');
    fireEvent.change(textarea, { target: { value: 'Обычный рабочий созвон' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// Тик-страйп прогресса — 10 div[role=button] без текста (pressable), порядок
// SCHEMA_DIARY_STEP_ORDER: 0 trigger, 1 emotions, 5 schemas, 8 excessiveReactions.
function ticks() {
  return screen.getAllByRole('button', { name: '' });
}

describe('SchemaEntrySheet — визард (шаги, обязательность, чипы)', () => {
  it('обязательна только ситуация — «Дальше» задизейблено, пока триггер пуст', () => {
    renderSheet();
    // Первый шаг обязателен — кнопка сразу подписана «Дальше», но задизейблена.
    const nextBtn = screen.getByText('Дальше').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    const trigger = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…');
    fireEvent.change(trigger, { target: { value: 'Созвон с командой' } });
    expect(nextBtn.disabled).toBe(false);
  });

  it('клик по тику переключает на шаг «Чувства» — чипы эмоций видны', () => {
    renderSheet();
    fireEvent.click(ticks()[1]);
    expect(screen.getByText('Страх')).toBeTruthy();
  });

  it('клик по тику переключает на шаг «Схемы» — чипы схем и поле «откуда это знакомо» видны', () => {
    renderSheet();
    fireEvent.click(ticks()[5]);
    expect(screen.getByText('Схемы')).toBeTruthy();
    expect(screen.getByPlaceholderText(/так папа в детстве оценивал/)).toBeTruthy();
  });

  // Регрессия: excessiveReactions («Где я преувеличиваю») был в черновике, но
  // потерял UI (useState без сеттера) — расхождение с миниаппом (правило
  // №3). Визард обязан вернуть шаг в обоих фронтендах.
  it('шаг «Где я преувеличиваю» (excessiveReactions) снова доступен и сохраняется', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <SchemaEntrySheet onClose={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );
    const trigger = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…');
    fireEvent.change(trigger, { target: { value: 'Созвон с командой' } });
    fireEvent.click(ticks()[8]); // индекс 8 в SCHEMA_DIARY_STEP_ORDER — excessiveReactions
    expect(screen.getByText('Где я преувеличиваю')).toBeTruthy();
    const area = screen.getByPlaceholderText(/реакция оказалась больше/);
    fireEvent.change(area, { target: { value: 'Слишком остро отреагировал на пустяк' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ excessiveReactions: 'Слишком остро отреагировал на пустяк' }),
    );
  });
});
