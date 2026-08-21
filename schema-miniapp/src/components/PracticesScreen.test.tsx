// @vitest-environment jsdom
// PracticesScreen — каталог практик по потребностям (0% покрытия). Проверяем:
// переключение вкладок-потребностей, контекстную подсказку при низкой оценке,
// добавление/удаление практики (включая видимую ошибку при сбое сохранения —
// правило «провал не выглядит как успех»), обе формы ты/вы и кризисную
// детекцию поля «добавить практику» (правило №7 — тут её раньше не было,
// см. фикс в этом же PR: свободный текст без CrisisCard был дефектом).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { PracticesScreen } from './PracticesScreen';
import { AddressFormContext } from '../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

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
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <PracticesScreen onClose={vi.fn()} onOpenTracker={vi.fn()} />
    </AddressFormContext.Provider>,
  );
}

describe('PracticesScreen — список практик', () => {
  it('на чистом аккаунте (нет практик) показывает пустое состояние, не выдуманные карточки', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    expect(
      await screen.findByText('Пока пусто — добавь первую практику ниже'),
    ).toBeTruthy();
  });

  it('рендерит реальные практики из API, а не заглушку', async () => {
    getPractices.mockResolvedValue([
      { id: 1, needId: 'attachment', text: 'Позвонить другу' },
    ]);
    renderScreen();
    expect(await screen.findByText('Позвонить другу')).toBeTruthy();
  });

  it('провал загрузки практик показывает явную ошибку, а не «Пока пусто» (сбой ≠ пусто)', async () => {
    // Регрессия: раньше .catch(() => setPractices([])) рисовал «Пока пусто —
    // добавь первую практику» человеку, у которого практики есть, просто
    // запрос отвалился (CLAUDE.md «сбой ≠ пусто»).
    getPractices.mockRejectedValue(new Error('network'));
    renderScreen();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить практики/);
    expect(screen.queryByText(/Пока пусто/)).toBeNull();
  });

  it('переключение вкладки потребности перезапрашивает практики для новой потребности', async () => {
    renderScreen();
    await waitFor(() =>
      expect(getPractices).toHaveBeenCalledWith('attachment'),
    );
    fireEvent.click(screen.getByText(/Автономия/));
    await waitFor(() => expect(getPractices).toHaveBeenCalledWith('autonomy'));
  });

  it('низкая сегодняшняя оценка потребности показывает контекстную подсказку', async () => {
    ratingsMock.mockResolvedValue({ attachment: 3 });
    renderScreen();
    expect(
      await screen.findByText(/хороший момент чтобы что-то сделать/),
    ).toBeTruthy();
  });
});

describe('PracticesScreen — добавление практики', () => {
  it('успешное сохранение очищает поле, показывает тост «Добавлено ✓» и обновляет список', async () => {
    addPractice.mockResolvedValue({});
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Добавить практику...');
    fireEvent.change(input, { target: { value: 'Прогулка 20 минут' } });
    fireEvent.click(screen.getByText('+'));

    await waitFor(() =>
      expect(addPractice).toHaveBeenCalledWith(
        'attachment',
        'Прогулка 20 минут',
      ),
    );
    expect(input.value).toBe('');
  });

  it('провал сохранения показывает видимую ошибку, а не молчаливый успех', async () => {
    // Регрессия на правило «провал не выглядит как успех»: без тоста
    // «Ошибка сохранения» юзер решил бы, что практика записалась.
    addPractice.mockRejectedValue(new Error('network'));
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Добавить практику...'), {
      target: { value: 'Что-то' },
    });
    fireEvent.click(screen.getByText('+'));

    expect(await screen.findByText('Ошибка сохранения')).toBeTruthy();
  });

  it('пустой ввод не отправляет запрос (кнопка недоступна)', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    const addBtn = screen.getByText('+');
    expect(addBtn.disabled).toBe(true);
    fireEvent.click(addBtn);
    expect(addPractice).not.toHaveBeenCalled();
  });
});

describe('PracticesScreen — удаление практики', () => {
  it('первый клик по × не удаляет (показывает подтверждение), второй убирает практику из списка (оптимистично) и шлёт запрос', async () => {
    // Двухтапное подтверждение (аудит 2026-08, К3): один тап по маленькой
    // кнопке больше не удаляет необратимо.
    getPractices.mockResolvedValue([
      { id: 5, needId: 'attachment', text: 'Медитация' },
    ]);
    deletePractice.mockResolvedValue({});
    renderScreen();
    await screen.findByText('Медитация');

    fireEvent.click(screen.getByLabelText('Удалить практику'));
    expect(deletePractice).not.toHaveBeenCalled();
    expect(screen.queryByText('Медитация')).toBeTruthy();

    fireEvent.click(screen.getByText('Точно удалить?'));
    expect(screen.queryByText('Медитация')).toBeNull();
    expect(deletePractice).toHaveBeenCalledWith(5);
  });

  it('провал deletePractice возвращает практику в список и показывает ошибку (regression: check-silent-catch)', async () => {
    // Раньше .catch(() => {}) молча проглатывал провал — практика исчезала
    // из UI навсегда, хотя на сервере оставалась (revert для optimistic
    // update — класс бага из CLAUDE.md).
    getPractices.mockResolvedValue([
      { id: 5, needId: 'attachment', text: 'Медитация' },
    ]);
    deletePractice.mockRejectedValue(new Error('network'));
    renderScreen();
    await screen.findByText('Медитация');

    fireEvent.click(screen.getByLabelText('Удалить практику'));
    fireEvent.click(screen.getByText('Точно удалить?'));
    expect(screen.queryByText('Медитация')).toBeNull();

    expect(await screen.findByText('Медитация')).toBeTruthy();
    expect(await screen.findByText('Ошибка сохранения')).toBeTruthy();
  });
});

describe('PracticesScreen — кризисная детекция поля «добавить практику» (правило №7)', () => {
  it('тревожный текст в поле показывает карточку помощи ДО отправки', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Добавить практику...'), {
      target: { value: 'не хочу жить' },
    });
    expect(
      await screen.findByText(new RegExp(CRISIS_HOTLINE_DISPLAY)),
    ).toBeTruthy();
  });

  it('нейтральный текст карточку не показывает', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Добавить практику...'), {
      target: { value: 'прогулка 20 минут' },
    });
    expect(screen.queryByText(new RegExp(CRISIS_HOTLINE_DISPLAY))).toBeNull();
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
