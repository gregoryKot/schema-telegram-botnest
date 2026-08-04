// @vitest-environment jsdom
// Кризисная детекция в свободном тексте «своё задание» (CLAUDE.md, правило
// №7) — парный тест webapp/src/components/TaskCreateSheet.test.tsx (правило
// №3). Регрессия: тип custom (личная цель) принимал произвольный текст без
// прогона через crisisMarkers — единственное поле свободного текста в
// компоненте, оставшееся без кризисной карточки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { TaskCreateSheet } from './TaskCreateSheet';

vi.mock('../api', () => ({
  api: {
    createTask: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as { createTask: ReturnType<typeof vi.fn> };

function renderSheet(onCreated = vi.fn(), onClose = vi.fn()) {
  return {
    onCreated,
    onClose,
    ...render(
      <TaskCreateSheet
        defaultType="custom"
        onCreated={onCreated}
        onClose={onClose}
      />,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TaskCreateSheet — кризисная детекция в описании своей цели', () => {
  it('кризисная фраза в описании задания показывает CrisisCard с телефоном доверия', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Например: позвонить другу раз в неделю',
    );

    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст цели не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Например: позвонить другу раз в неделю',
    );

    fireEvent.change(textarea, {
      target: { value: 'Читать по 10 страниц в день' },
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('TaskCreateSheet — сохранение своей цели', () => {
  it('успешное сохранение вызывает api.createTask с текстом типа custom и onCreated', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const { onCreated } = renderSheet();
    fireEvent.change(
      screen.getByPlaceholderText('Например: позвонить другу раз в неделю'),
      {
        target: { value: 'Пить больше воды' },
      },
    );

    fireEvent.click(screen.getByText('Создать задание'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'custom', text: 'Пить больше воды' }),
    );
  });

  it('ошибка api.createTask показывает сообщение, а не тишину — onCreated не вызывается', async () => {
    mockApi.createTask.mockRejectedValue(new Error('network down'));
    const { onCreated } = renderSheet();
    fireEvent.change(
      screen.getByPlaceholderText('Например: позвонить другу раз в неделю'),
      {
        target: { value: 'Гулять по вечерам' },
      },
    );

    fireEvent.click(screen.getByText('Создать задание'));

    await screen.findByText('Не удалось сохранить');
    expect(onCreated).not.toHaveBeenCalled();
  });
});
