// @vitest-environment jsdom
// PracticesScreen — каталог практик по потребностям (0% покрытия). Проверяем:
// переключение вкладок-потребностей, контекстная подсказка при низкой оценке,
// добавление/удаление практики (включая видимую ошибку API при сбое сохранения
// — правило CLAUDE.md «провал не выглядит как успех»), обе формы ты/вы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticesScreen } from './PracticesScreen';
import { AddressFormContext } from '../utils/addressForm';

const getPractices = vi.fn();
const addPractice = vi.fn();
const deletePractice = vi.fn();
const ratingsMock = vi.fn();

vi.mock('../api', () => ({
  api: {
    ratings: (...a: unknown[]) => ratingsMock(...a),
    getPractices: (...a: unknown[]) => getPractices(...a),
    addPractice: (...a: unknown[]) => addPractice(...a),
    deletePractice: (...a: unknown[]) => deletePractice(...a),
    trackEvent: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  ratingsMock.mockResolvedValue({});
  getPractices.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderScreen(form: 'ty' | 'vy' = 'ty') {
  return render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <PracticesScreen onClose={vi.fn()} onOpenTracker={vi.fn()} />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

describe('PracticesScreen — список практик', () => {
  it('на чистом аккаунте (нет практик) показывает пустое состояние, не выдуманные карточки', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    expect(await screen.findByText('Пока пусто – добавь первую практику ниже.')).toBeTruthy();
  });

  it('рендерит реальные практики из API, а не заглушку', async () => {
    getPractices.mockResolvedValue([{ id: 1, needId: 'attachment', text: 'Позвонить другу' }]);
    renderScreen();
    expect(await screen.findByText('Позвонить другу')).toBeTruthy();
  });

  it('переключение вкладки потребности перезапрашивает практики для новой потребности', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalledWith('attachment'));
    fireEvent.click(screen.getByText('Автономия'));
    await waitFor(() => expect(getPractices).toHaveBeenCalledWith('autonomy'));
  });

  it('низкая сегодняшняя оценка потребности показывает контекстную подсказку', async () => {
    ratingsMock.mockResolvedValue({ attachment: 3 });
    renderScreen();
    expect(await screen.findByText(/хороший момент чтобы что-то сделать/)).toBeTruthy();
  });
});

describe('PracticesScreen — добавление практики', () => {
  it('успешное сохранение очищает поле и показывает тост «Добавлено», список обновляется', async () => {
    addPractice.mockResolvedValue({});
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Добавить практику...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Прогулка 20 минут' } });
    fireEvent.click(screen.getByText('+ Добавить'));

    await waitFor(() => expect(addPractice).toHaveBeenCalledWith('attachment', 'Прогулка 20 минут'));
    expect(await screen.findByText('Добавлено')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('провал сохранения показывает видимую ошибку, а не молчаливый успех', async () => {
    // Регрессия на правило «провал не выглядит как успех»: если бы тост
    // не появлялся, юзер решил бы, что практика сохранилась.
    addPractice.mockRejectedValue(new Error('network'));
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Добавить практику...');
    fireEvent.change(input, { target: { value: 'Что-то' } });
    fireEvent.click(screen.getByText('+ Добавить'));

    expect(await screen.findByText('Ошибка сохранения')).toBeTruthy();
    expect(screen.queryByText('Добавлено')).toBeNull();
  });

  it('пустой ввод не отправляет запрос (кнопка недоступна)', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    const addBtn = screen.getByText('+ Добавить') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    fireEvent.click(addBtn);
    expect(addPractice).not.toHaveBeenCalled();
  });
});

describe('PracticesScreen — удаление практики', () => {
  it('клик «удалить» убирает практику из списка сразу (оптимистично) и шлёт запрос', async () => {
    getPractices.mockResolvedValue([{ id: 5, needId: 'attachment', text: 'Медитация' }]);
    deletePractice.mockResolvedValue({});
    renderScreen();
    await screen.findByText('Медитация');

    fireEvent.click(screen.getByText('удалить'));
    expect(screen.queryByText('Медитация')).toBeNull();
    expect(deletePractice).toHaveBeenCalledWith(5);
  });

  // Регрессия: сбой удаления глушился `.catch(() => {})` — практика исчезала
  // с экрана, оставаясь в БД, и воскресала при следующем заходе. Теперь сбой
  // показывает ошибку и возвращает список с сервера.
  it('сбой удаления показывает ошибку и возвращает практику в список', async () => {
    getPractices.mockResolvedValue([{ id: 5, needId: 'attachment', text: 'Медитация' }]);
    deletePractice.mockRejectedValue(new Error('offline'));
    renderScreen();
    await screen.findByText('Медитация');

    await act(async () => {
      fireEvent.click(screen.getByText('удалить'));
    });
    expect(screen.getByText('Ошибка сохранения')).toBeTruthy();
    // Список перечитан с сервера — практика на месте, а не исчезла навсегда.
    await screen.findByText('Медитация');
    expect(getPractices.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('PracticesScreen — кризисная детекция поля «добавить практику» (правило №7)', () => {
  // Регрессия: поле было чистым свободным текстом без crisisMarkers — тот же
  // класс дефекта, что закрыт в TaskCreateSheet/LetterEx, здесь его не было.
  it('тревожный текст в поле показывает карточку помощи ДО отправки', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Добавить практику...'), {
      target: { value: 'не хочу жить' },
    });
    expect(await screen.findByText(/8-800-2000-122/)).toBeTruthy();
  });

  it('нейтральный текст карточку не показывает', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Добавить практику...'), {
      target: { value: 'прогулка 20 минут' },
    });
    expect(screen.queryByText(/8-800-2000-122/)).toBeNull();
  });
});

describe('PracticesScreen — ты/вы', () => {
  it('форма «ты»: подсказка про трекер обращается на «ты»', async () => {
    renderScreen('ty');
    expect(await screen.findByText('Открой трекер →')).toBeTruthy();
  });

  it('форма «вы»: подсказка про трекер обращается на «вы», без остаточного «ты»', async () => {
    renderScreen('vy');
    expect(await screen.findByText('Откройте трекер →')).toBeTruthy();
    expect(screen.queryByText('Открой трекер →')).toBeNull();
  });
});
