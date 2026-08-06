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
import { TaskCreateSheet, getTaskDisplayText } from './TaskCreateSheet';
import { SCHEMA_DOMAINS, ALL_MODES } from '../schemaTherapyData';

const FIRST_SCHEMA = SCHEMA_DOMAINS[0].schemas[0];
const FIRST_MODE = ALL_MODES[0];

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
  // jsdom не реализует scrollIntoView — компонент зовёт его (через setTimeout)
  // при переключении на schema_intro/mode_intro, иначе тест ловит unhandled
  // rejection уже после завершения самого it().
  Element.prototype.scrollIntoView = vi.fn();
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

describe('TaskCreateSheet — дефолтный тип diary_streak и пустая цель custom', () => {
  it('diary_streak (тип по умолчанию) отправляет текст с реальным числом дней', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Создать задание'));
    await waitFor(() =>
      expect(mockApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'diary_streak',
          text: 'Заполнять дневник 7 дней подряд',
          targetDays: 7,
        }),
      ),
    );
  });

  it('custom без текста — ошибка «Введи описание задания», createTask не вызывается', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Создать задание'));
    expect(screen.getByText('Введи описание задания')).toBeTruthy();
    expect(mockApi.createTask).not.toHaveBeenCalled();
  });

  it('срок сохраняется вместе с заданием, если выбран', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const { onCreated } = renderSheet();
    fireEvent.change(
      screen.getByPlaceholderText('Например: позвонить другу раз в неделю'),
      { target: { value: 'Пить воду' } },
    );
    const dateInput = document.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByText('Создать задание'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: '2026-09-01' }),
    );
  });
});

describe('getTaskDisplayText — читаемое название по типу задания', () => {
  it('schema_intro резолвит id в реальное название схемы', () => {
    expect(getTaskDisplayText('schema_intro', FIRST_SCHEMA.id)).toBe(
      `Карточка схемы: ${FIRST_SCHEMA.name}`,
    );
  });

  it('schema_intro с неизвестным id — фолбэк без выдуманного названия', () => {
    expect(getTaskDisplayText('schema_intro', 'not-a-real-id')).toBe(
      'Карточка схемы',
    );
  });

  it('mode_intro резолвит id в реальное название режима', () => {
    expect(getTaskDisplayText('mode_intro', FIRST_MODE.id)).toBe(
      `Карточка режима: ${FIRST_MODE.name}`,
    );
  });

  it('прочие типы — текст как есть', () => {
    expect(getTaskDisplayText('custom', 'Пить воду')).toBe('Пить воду');
  });
});

describe('TaskCreateSheet — переключение типа задания меняет форму под тип', () => {
  it('дефолт diary_streak — виден выбор дней стрика (targetDays=7 по умолчанию)', () => {
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Цель в днях')).toBeTruthy();
    // 7 — выбранный по умолчанию (акцентный текст), не хардкод в тесте, а
    // реальный STREAK_OPTIONS-пункт с активным стилем.
    const seven = screen.getByText('7');
    expect(seven.style.color).toBe('var(--accent)');
  });

  it('клик по другому значению стрика меняет активный пункт', () => {
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('14'));
    expect(screen.getByText('14').style.color).toBe('var(--accent)');
    expect(screen.getByText('7').style.color).not.toBe('var(--accent)');
  });

  it('переключение на tracker_streak тоже показывает выбор дней и правильный текст задачи', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Трекер потребностей'));
    expect(screen.getByText('Цель в днях')).toBeTruthy();
    fireEvent.click(screen.getByText('Создать задание'));
    await waitFor(() =>
      expect(mockApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tracker_streak',
          text: 'Отмечать потребности 7 дней подряд',
          targetDays: 7,
        }),
      ),
    );
  });

  it.each([
    ['belief_check', 'Проверить убеждение', 'Проверить убеждение'],
    ['letter_to_self', 'Письмо себе', 'Написать письмо Уязвимому Ребёнку'],
    ['safe_place', 'Безопасное место', 'Описать Безопасное место'],
    ['flashcard', 'Мне сейчас плохо', 'Разобрать сложную ситуацию по шагам'],
  ])(
    'тип %s отправляет фиксированный текст задания без стрика',
    async (type, label, expectedText) => {
      mockApi.createTask.mockResolvedValue({ id: 1 });
      render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText(label));
      fireEvent.click(screen.getByText('Создать задание'));
      await waitFor(() =>
        expect(mockApi.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            type,
            text: expectedText,
            targetDays: undefined,
          }),
        ),
      );
    },
  );
});

describe('TaskCreateSheet — schema_intro/mode_intro требуют выбора, иначе видимая ошибка', () => {
  it('schema_intro без выбранной схемы — ошибка «Выбери схему», createTask не вызывается', () => {
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Карточка схемы'));
    fireEvent.click(screen.getByText('Создать задание'));
    expect(screen.getByText('Выбери схему')).toBeTruthy();
    expect(mockApi.createTask).not.toHaveBeenCalled();
  });

  it('выбор реальной схемы и сохранение отправляет её id', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const onCreated = vi.fn();
    render(<TaskCreateSheet onCreated={onCreated} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Карточка схемы'));
    fireEvent.click(screen.getByText(FIRST_SCHEMA.name));
    fireEvent.click(screen.getByText('Создать задание'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'schema_intro', text: FIRST_SCHEMA.id }),
    );
  });

  it('mode_intro без выбранного режима — ошибка «Выбери режим»', () => {
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Карточка режима'));
    fireEvent.click(screen.getByText('Создать задание'));
    expect(screen.getByText('Выбери режим')).toBeTruthy();
    expect(mockApi.createTask).not.toHaveBeenCalled();
  });

  it('выбор реального режима и сохранение отправляет его id', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    const onCreated = vi.fn();
    render(<TaskCreateSheet onCreated={onCreated} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Карточка режима'));
    fireEvent.click(screen.getByText(FIRST_MODE.name));
    fireEvent.click(screen.getByText('Создать задание'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mode_intro', text: FIRST_MODE.id }),
    );
  });
});

describe('TaskCreateSheet — срок появляется для custom-типа и для терапевта, назначающего клиенту', () => {
  it('custom-тип по умолчанию — поле срока видно', () => {
    renderSheet();
    expect(screen.getByText('Срок (необязательно)')).toBeTruthy();
  });

  it('не-custom тип без clientId — поля срока нет', () => {
    render(<TaskCreateSheet onCreated={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('Срок (необязательно)')).toBeNull();
  });

  it('не-custom тип, но задание для клиента (clientId задан) — поле срока видно', () => {
    render(
      <TaskCreateSheet
        clientId={42}
        clientName="Аня"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Задание для Аня')).toBeTruthy();
    expect(screen.getByText('Срок (необязательно)')).toBeTruthy();
  });
});
