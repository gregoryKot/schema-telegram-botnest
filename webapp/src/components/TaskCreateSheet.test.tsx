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
import { TASK_TEXT_MAX } from '../../../shared/src/limits/textLimits';

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

  // QA 2026-10-26: лист закрывался setShowAssign(false) мимо истории, и
  // первое «Назад» браузера после назначения ничего не делало.
  it('после сохранения лист закрывается через историю (goBack → onClose)', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const { onCreated, onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText('Например: позвонить другу раз в неделю'), {
      target: { value: 'Пить больше воды' },
    });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
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

function renderFor(props: Partial<React.ComponentProps<typeof TaskCreateSheet>>) {
  return render(
    <MemoryRouter>
      <TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe('TaskCreateSheet — назначение терапевтом (QA 2026-10-26)', () => {
  it('серия на 3 дня сохраняется с верным склонением', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    renderFor({ clientId: 42, defaultType: 'tracker_streak' });
    fireEvent.click(screen.getByText('3 дн'));
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tracker_streak', text: 'Отмечать потребности 3 дня подряд', targetDays: 3 }),
    ));
  });

  it('клиенту с аккаунтом — «в приложении», без «мини-аппа» и «он»', () => {
    renderFor({ clientId: 42 });
    expect(screen.getByText(/появится у клиента в приложении/)).toBeTruthy();
    expect(screen.queryByText(/мини-апп/)).toBeNull();
  });

  it('офлайн-клиенту — честная подпись и только «Своё задание»', () => {
    renderFor({ clientId: -5 });
    expect(screen.getByText(/Клиент не пользуется приложением/)).toBeTruthy();
    expect(screen.getByText('Своё задание')).toBeTruthy();
    expect(screen.queryByText('Трекер потребностей')).toBeNull();
    expect(screen.getByPlaceholderText('Например: позвонить другу раз в неделю')).toBeTruthy();
  });

  it('своя цель клиента — без подписи про клиента', () => {
    renderFor({ defaultType: 'custom' });
    expect(screen.queryByText(/у клиента/)).toBeNull();
  });

  it('шаблон открывает лист с типом и текстом шаблона', () => {
    renderFor({ clientId: 42, defaultType: 'custom', defaultText: 'Дневник режима: ' });
    const area = screen.getByPlaceholderText('Например: позвонить другу раз в неделю') as HTMLTextAreaElement;
    expect(area.value).toBe('Дневник режима: ');
  });

  it('«Своё задание» с пределом сервера: maxLength и счётчик у границы', () => {
    renderFor({ defaultType: 'custom' });
    const area = screen.getByPlaceholderText('Например: позвонить другу раз в неделю') as HTMLTextAreaElement;
    expect(area.maxLength).toBe(TASK_TEXT_MAX);
    fireEvent.change(area, { target: { value: 'а'.repeat(TASK_TEXT_MAX - 5) } });
    expect(screen.getByText('Осталось знаков: 5')).toBeTruthy();
  });
});
