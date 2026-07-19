// @vitest-environment jsdom
// Тот же аудит автосейва, что и SchemaIntroSheet.test.tsx (см. комментарий
// там) — ModeIntroSheet использует идентичный паттерн `set()`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { ModeIntroSheet } from './ModeIntroSheet';

vi.mock('../api', () => ({
  api: { getModeNotes: vi.fn(), saveModeNote: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

async function openFirstQuestion() {
  render(<ModeIntroSheet modeId="vulnerable_child" onClose={() => {}} />);
  await act(async () => {}); // flush getModeNotes()
  fireEvent.click(screen.getByText('Когда активируется'));
  return screen.getByPlaceholderText(/Когда меня критикуют/);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.saveModeNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModeIntroSheet — автосейв карточки (setTimeout(1500) в set())', () => {
  it('не отправляет запрос сразу — только после паузы 1500мс', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'Триггер' } });
    expect(mockApi.saveModeNote).not.toHaveBeenCalled();
  });

  it('НЕ БАГ: серия быстрых правок в одном окне дебаунса — сохраняется ПОСЛЕДНЕЕ значение, один вызов api', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'K' } });
    fireEvent.change(textarea, { target: { value: 'Kр' } });
    fireEvent.change(textarea, { target: { value: 'Крик' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote).toHaveBeenCalledTimes(1);
    expect(mockApi.saveModeNote.mock.calls[0][0]).toMatchObject({
      modeId: 'vulnerable_child',
      triggers: 'Крик',
    });
  });

  it('НЕ БАГ: вторая волна правок после завершённого автосейва не отстаёт на шаг', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'A' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote.mock.calls[0][0].triggers).toBe('A');

    fireEvent.change(textarea, { target: { value: 'AB' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote).toHaveBeenCalledTimes(2);
    expect(mockApi.saveModeNote.mock.calls[1][0].triggers).toBe('AB');
  });
});
