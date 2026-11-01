// @vitest-environment jsdom
// Кризисная детекция в дневнике схем (CLAUDE.md, правило №7) — эталонный
// компонент, на который ориентировались остальные 5 (см. CrisisCard.test.tsx,
// NoteSheet.test.tsx и др.). Проверяем основное поле "trigger".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEntrySheet } from './SchemaEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn(), getTherapyRelation: vi.fn(), getSettings: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

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
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getSettings.mockResolvedValue({ therapistShareCards: true });
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

// В7 дизайн-аудита 2026-08: поле связано с видимым вопросом программно.
describe('SchemaEntrySheet — поля связаны с вопросом (В7)', () => {
  it('первый шаг: textarea доступно по вопросу «Что случилось?»', () => {
    renderSheet();
    const byLabel = screen.getByLabelText('Что случилось?');
    const byPlaceholder = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…');
    expect(byLabel).toBe(byPlaceholder);
  });

  it('шаг «Схемы»: поле «откуда это знакомо» доступно по своему вопросу', () => {
    renderSheet();
    fireEvent.click(ticks()[5]);
    expect(screen.getByLabelText('Откуда это знакомо?')).toBeTruthy();
  });
});

// Тик-страйп прогресса — 10 div[role=button] (pressable) с именами «Шаг N»,
// порядок SCHEMA_DIARY_STEP_ORDER: 0 trigger, 1 emotions, 5 schemas, 8 excessiveReactions.
function ticks() {
  return screen.getAllByRole('button', { name: /^Шаг \d+$/ });
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

  // Аудит 2026-10, «Доступность»: тики были pressable()-div без содержимого —
  // скринридер читал ряд одинаковых «кнопка», не называя шаг.
  it('тик назван номером шага и помечает текущий, интенсивность — эмоцией и степенью', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Шаг 1' }).getAttribute('aria-current')).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: 'Шаг 2' }));
    expect(screen.getByRole('button', { name: 'Шаг 2' }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Шаг 1' }).getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByText('Страх'));
    expect(screen.getByRole('button', { name: 'Страх: заметно' })).toBeTruthy();
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

// backend#29: раньше контроллер молча резал поля дневника до 2000 знаков, а
// поле ввода предела не знало. Теперь предел один (DIARY_FIELD_MAX) и виден.
describe('SchemaEntrySheet — предел длины поля', () => {
  it('textarea.maxLength = предел поля дневника из shared; у границы виден остаток', () => {
    renderSheet();
    const area = screen.getByLabelText('Что случилось?') as HTMLTextAreaElement;
    expect(area.maxLength).toBe(DIARY_FIELD_MAX);
    expect(screen.queryByText(/Осталось знаков/)).toBeNull();
    fireEvent.change(area, { target: { value: 'а'.repeat(DIARY_FIELD_MAX - 7) } });
    expect(screen.getByText(/Осталось знаков: 7/)).toBeTruthy();
  });
});

// 2026-10-26: «Никто кроме вас не увидит» висело и при подключённом терапевте,
// который видел записи. Строка — по правилу сервера (shared/src/diary/diaryPrivacy.ts).
describe('SchemaEntrySheet — кто увидит записи', () => {
  const client = { role: 'client', status: 'active', partnerName: 'Анна', partnerId: 42, code: 'A', nextSession: null };

  it('терапевта нет — «Никто кроме тебя не увидит»', async () => {
    renderSheet();
    expect(await screen.findByText('Никто кроме тебя не увидит')).toBeTruthy();
  });

  it('терапевт подключён, доступ открыт — сказано, что терапевт видит, без «никто»', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(client);
    renderSheet();
    expect(await screen.findByText('Записи видит и твой терапевт — закрыть можно в настройках, «Мой терапевт»')).toBeTruthy();
    expect(screen.queryByText(/Никто кроме/)).toBeNull();
  });

  it('терапевт подключён, «Карточки схем и режимов» выключены — терапевт не видит', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(client);
    mockApi.getSettings.mockResolvedValue({ therapistShareCards: false });
    renderSheet();
    expect(await screen.findByText('Никто кроме тебя не увидит: терапевту доступ к записям закрыт в настройках')).toBeTruthy();
  });

  it('связь не загрузилась — обещания нет вовсе', async () => {
    mockApi.getTherapyRelation.mockRejectedValue(new Error('offline'));
    renderSheet();
    await waitFor(() => expect(mockApi.getTherapyRelation).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(/Никто кроме|терапевт —/)).toBeNull();
    expect(screen.getByText('Можно вернуться и продолжить')).toBeTruthy();
  });
});

