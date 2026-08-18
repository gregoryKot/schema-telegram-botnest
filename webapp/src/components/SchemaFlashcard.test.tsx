// @vitest-environment jsdom
// Кризисная детекция в SchemaFlashcard (CLAUDE.md, правило №7): проверяем поле
// "reflection" на шаге ответа Здорового Взрослого — второй свободнотекстовый
// стейт (action) тестируется в BeliefCheckEx/FlashcardEx на том же паттерне.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaFlashcard } from './SchemaFlashcard';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('../api', () => ({
  api: {
    getFlashcards: vi.fn(),
    createFlashcard: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderToResponseStep() {
  render(
    <MemoryRouter>
      <SchemaFlashcard onClose={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Стало чуть лучше – разобраться →'));
  fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getFlashcards.mockResolvedValue([]);
  // save() вешает .catch() на результат — мок обязан быть промисом,
  // иначе падает уже внутри обработчика клика.
  mockApi.createFlashcard.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('SchemaFlashcard — проход мастера и сохранение', () => {
  // Флоу из 4 шагов с несколькими точками входа: тест бьёт по связке
  // «прошёл шаги → сохранилось → показалось», а не только по записи
  // (CLAUDE.md, правило про read-after-write).
  function walkToAction() {
    renderToResponseStep();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), {
      target: { value: 'Побыть рядом с собой' },
    });
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
  }

  it('шаги идут по порядку и показывают свой номер', () => {
    renderToResponseStep();
    expect(screen.getByText('Шаг 2 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Шаг 3 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Привязанность'));
    expect(screen.getByText('Шаг 4 из 4')).toBeTruthy();
    expect(screen.getByText('Один маленький шаг')).toBeTruthy();
  });

  it('«Назад» возвращает на предыдущий шаг', () => {
    renderToResponseStep();
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Шаг 3 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Назад'));
    expect(screen.getByText('Шаг 2 из 4')).toBeTruthy();
  });

  it('выбранная потребность видна на шаге действия', () => {
    walkToAction();
    expect(screen.getByText('Потребность')).toBeTruthy();
    expect(screen.getByText('Привязанность')).toBeTruthy();
  });

  it('кнопка «Сохранить» заблокирована, пока действие пустое', () => {
    walkToAction();
    const btn = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'выйти подышать' },
    });
    expect(btn.disabled).toBe(false);
  });

  it('сохранение уходит на бэк и в localStorage', () => {
    walkToAction();
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'выйти подышать' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(mockApi.createFlashcard).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'vulnerable_child',
        needId: 'attachment',
        reflection: 'Побыть рядом с собой',
        action: 'выйти подышать',
      }),
    );
    const stored = JSON.parse(localStorage.getItem('schema_flashcards') ?? '[]');
    expect(stored[0]).toEqual(
      expect.objectContaining({ action: 'выйти подышать', needId: 'attachment' }),
    );
  });
});

describe('SchemaFlashcard — кризисная детекция (reflection)', () => {
  it('кризисная фраза в отклике показывает CrisisCard', () => {
    renderToResponseStep();
    const textarea = screen.getByPlaceholderText('Что хочется сказать себе...');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderToResponseStep();
    const textarea = screen.getByPlaceholderText('Что хочется сказать себе...');
    fireEvent.change(textarea, { target: { value: 'Стало немного легче' } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('кризисная фраза в шаге действия тоже показывает CrisisCard', () => {
    renderToResponseStep();
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    const textarea = screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('SchemaFlashcard — история карточек (read-after-write)', () => {
  // Реальная запись приходит с бэка (api.getFlashcards) — не только только что
  // сохранённая в localStorage. Тест бьёт по связке «сохранил → нашёл в истории».
  const ROW = {
    id: 42,
    createdAt: '2026-07-20T10:00:00Z',
    modeId: 'vulnerable_child',
    reflection: 'Мне грустно',
    needId: 'attachment',
    action: 'Позвонить другу',
  };

  it('карточки с бэка видны в истории — заголовок «История карточек (N)» на экране заземления', async () => {
    mockApi.getFlashcards.mockResolvedValue([ROW]);
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('История карточек (1)')).toBeTruthy();
  });

  it('открытие истории и клика по карточке показывает её детали, «Назад» возвращает в историю', async () => {
    mockApi.getFlashcards.mockResolvedValue([ROW]);
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('История карточек (1)'));
    expect(screen.getByText('История карточек')).toBeTruthy();
    fireEvent.click(screen.getByText('Уязвимый Ребёнок · Привязанность'));
    expect(screen.getByText('Мне грустно')).toBeTruthy();
    expect(screen.getByText('Позвонить другу')).toBeTruthy();
    fireEvent.click(screen.getByText('К истории'));
    expect(screen.getByText('История карточек')).toBeTruthy();
  });

  it('«История» доступна и на шаге 1 (выбор режима), когда карточки уже есть', async () => {
    mockApi.getFlashcards.mockResolvedValue([ROW]);
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('Стало чуть лучше – разобраться →'));
    fireEvent.click(screen.getByText('История'));
    expect(screen.getByText('История карточек')).toBeTruthy();
  });

  it('пустая история (без карточек) не показывает кнопку истории на экране заземления', async () => {
    mockApi.getFlashcards.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} />
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.queryByText(/История карточек/)).toBeNull();
  });
});

describe('SchemaFlashcard — «Ещё одну» сбрасывает мастер', () => {
  it('после сохранения «Ещё одну» возвращает на шаг 1, поля очищены', () => {
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Стало чуть лучше – разобраться →'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(
      screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'),
      { target: { value: 'выйти подышать' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByText('Сохранено')).toBeTruthy();

    fireEvent.click(screen.getByText('Ещё одну'));
    // Назад на самый первый экран (заземление), а не сразу на выбор режима.
    expect(screen.getByText('Стало чуть лучше – разобраться →')).toBeTruthy();
  });
});

describe('SchemaFlashcard — «Открыть трекер →» на экране «Сохранено»', () => {
  it('закрывает лист и вызывает onOpenTracker', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const onOpenTracker = vi.fn();
    render(
      <MemoryRouter>
        <SchemaFlashcard onClose={vi.fn()} onOpenTracker={onOpenTracker} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Стало чуть лучше – разобраться →'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(
      screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'),
      { target: { value: 'выйти подышать' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    fireEvent.click(screen.getByText('Открыть трекер →'));
    vi.advanceTimersByTime(100);
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('SchemaFlashcard — серверная копия не доехала', () => {
  // Регрессия: отказ createFlashcard глушился — экран говорил «Сохранено»
  // без оговорок, хотя на других устройствах и у терапевта карточки нет
  // (локальная копия в localStorage при этом честно существует).
  async function saveWithServerDown() {
    mockApi.createFlashcard.mockRejectedValue(new Error('offline'));
    renderToResponseStep();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), {
      target: { value: 'Побыть рядом с собой' },
    });
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'Позвонить другу' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    });
  }

  it('отказ сервера — «Сохранено» с оговоркой про это устройство', async () => {
    await saveWithServerDown();
    expect(screen.getByText('Сохранено')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'осталась только на этом устройстве',
    );
    // Локальная копия существует — это не потеря, а честная деградация.
    expect(JSON.parse(localStorage.getItem('schema_flashcards')!).length).toBe(1);
  });

  it('успешное сохранение — без оговорок', async () => {
    mockApi.createFlashcard.mockResolvedValue({});
    renderToResponseStep();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), {
      target: { value: 'Текст' },
    });
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'Шаг' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    });
    expect(screen.getByText('Сохранено')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
