// @vitest-environment jsdom
// Кризисная детекция в свободном тексте «своё задание» (CLAUDE.md, правило
// №7). Регрессия: TaskCreateSheet принимал произвольный текст пользователя
// (тип custom — личная цель) без прогона через crisisMarkers — единственное
// поле свободного текста в компоненте, оставшееся без кризисной карточки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskCreateSheet } from './TaskCreateSheet';
import { AddressFormContext } from '../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

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
      <MemoryRouter>
        <TaskCreateSheet defaultType="custom" onCreated={onCreated} onClose={onClose} />
      </MemoryRouter>,
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
  it('кризисная фраза в описании задания показывает CrisisCard с телефоном доверия', async () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: позвонить другу раз в неделю');

    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст цели не показывает CrisisCard', async () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: позвонить другу раз в неделю');

    fireEvent.change(textarea, { target: { value: 'Читать по 10 страниц в день' } });

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('TaskCreateSheet — сохранение своей цели', () => {
  it('успешное сохранение вызывает api.createTask с текстом типа custom и onCreated', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const { onCreated } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText('Например: позвонить другу раз в неделю'), {
      target: { value: 'Пить больше воды' },
    });

    fireEvent.click(screen.getByText('Назначить задание'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'custom', text: 'Пить больше воды' }),
    );
  });

  it('пустой текст блокирует кнопку сохранения — api не вызывается', () => {
    renderSheet();
    const saveBtn = screen.getByText('Назначить задание') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('ты/вы: заголовок и ошибка валидации звучат в форме пользователя (правило CLAUDE.md)', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <TaskCreateSheet defaultType="schema_intro" onCreated={vi.fn()} onClose={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Выберите')).toBeTruthy();
    expect(screen.queryByText('Выбери')).toBeNull();
    fireEvent.click(screen.getByText('Назначить задание'));
    expect(screen.queryByText('Выбери схему')).toBeNull(); // не должно быть тыкающей ошибки
    expect(screen.getByText('Выберите схему')).toBeTruthy();
  });

  it('ошибка api.createTask показывает сообщение, а не тишину — onCreated не вызывается', async () => {
    mockApi.createTask.mockRejectedValue(new Error('network down'));
    const { onCreated } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText('Например: позвонить другу раз в неделю'), {
      target: { value: 'Гулять по вечерам' },
    });

    fireEvent.click(screen.getByText('Назначить задание'));

    await screen.findByText('Не удалось сохранить');
    expect(onCreated).not.toHaveBeenCalled();
  });
});
