// @vitest-environment jsdom
// PracticesScreen — каталог практик по потребностям (0% покрытия). Проверяем:
// переключение вкладок-потребностей, контекстная подсказка при низкой оценке,
// добавление/удаление практики (включая видимую ошибку API при сбое сохранения
// — правило CLAUDE.md «провал не выглядит как успех»), обе формы ты/вы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { MemoryRouter, useLocation, type Location } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PracticesScreen } from './PracticesScreen';
import { sheetStackOf } from '../hooks/historySheetStack';
import { AddressFormContext } from '../utils/addressForm';
import { describeCrisisField } from '../test-support/crisisCardHarness';

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

// «Открой трекер →»: каталог уходил из дерева мимо своего goBack (AppOverlays: setShowPractices(false)),
// запись истории оставалась брошенной — следующее системное «Назад» уходило вхолостую.
describe('PracticesScreen — переход в трекер', () => {
  it('каталог закрывается своим goBack: записи истории не остаётся, потом открывается трекер', async () => {
    ratingsMock.mockResolvedValue({ attachment: 2 });
    const snap = { loc: null as Location | null };
    const onOpenTracker = vi.fn();
    function Overlays() {
      const [open, setOpen] = useState(true);
      const loc = useLocation();
      useEffect(() => { snap.loc = loc; });
      return open ? <PracticesScreen onClose={() => setOpen(false)} onOpenTracker={() => { setOpen(false); onOpenTracker(); }} /> : null;
    }
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}><Overlays /></AddressFormContext.Provider>
      </MemoryRouter>,
    );
    const link = await screen.findByText('Открой трекер →');
    expect(sheetStackOf(snap.loc!.state)).toHaveLength(1);
    fireEvent.click(link);
    await waitFor(() => expect(onOpenTracker).toHaveBeenCalledTimes(1));
    expect(sheetStackOf(snap.loc!.state)).toHaveLength(0);
  });
});

describe('PracticesScreen — список практик', () => {
  it('на чистом аккаунте (нет практик) показывает пустое состояние, не выдуманные карточки', async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
    const empty = await screen.findByText('Пока пусто — добавь первое действие ниже.');
    // Ревью g6: под заголовком потребности с её знаком пустая строка — знак действия (Leaf), а не тот же
    // знак потребности второй раз столбиком.
    const box = empty.closest('.pp-empty')!;
    expect(box.classList.contains('pp-empty--sign')).toBe(true);
    const headArt = document.querySelector('.sk-feed-head .pp-row-art svg')!.innerHTML;
    expect(box.querySelector('svg')!.innerHTML).not.toBe(headArt);
  });

  it('рендерит реальные практики из API, а не заглушку', async () => {
    getPractices.mockResolvedValue([
      { id: 1, needId: 'attachment', text: 'Позвонить другу' },
    ]);
    renderScreen();
    expect(await screen.findByText('Позвонить другу')).toBeTruthy();
  });

  it('переключение вкладки потребности перезапрашивает практики для новой потребности', async () => {
    renderScreen();
    await waitFor(() =>
      expect(getPractices).toHaveBeenCalledWith('attachment'),
    );
    fireEvent.click(screen.getByText('Автономия'));
    await waitFor(() => expect(getPractices).toHaveBeenCalledWith('autonomy'));
  });

  it('сбой ≠ пусто: отказ загрузки показывает «не удалось», а не «Пока пусто — добавь первую»', async () => {
    getPractices.mockRejectedValue(new Error('network'));
    renderScreen();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Не удалось загрузить список/)).toBeTruthy();
    expect(screen.queryByText(/Пока пусто/)).toBeNull();
  });

  it('низкая сегодняшняя оценка потребности показывает контекстную подсказку', async () => {
    ratingsMock.mockResolvedValue({ attachment: 3 });
    renderScreen();
    expect(
      await screen.findByText(/хороший момент, чтобы что-то сделать/),
    ).toBeTruthy();
  });
});

describe('PracticesScreen — добавление практики', () => {
  it('успешное сохранение очищает поле и показывает тост «Добавлено», список обновляется', async () => {
    addPractice.mockResolvedValue({});
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(
      'Добавить действие…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Прогулка 20 минут' } });
    fireEvent.click(screen.getByText('+ Добавить'));

    await waitFor(() =>
      expect(addPractice).toHaveBeenCalledWith(
        'attachment',
        'Прогулка 20 минут',
      ),
    );
    expect(await screen.findByText('Добавлено')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('провал сохранения показывает видимую ошибку, а не молчаливый успех', async () => {
    // Регрессия на правило «провал не выглядит как успех»: если бы тост
    // не появлялся, юзер решил бы, что практика сохранилась.
    addPractice.mockRejectedValue(new Error('network'));
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Добавить действие…');
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
    getPractices.mockResolvedValue([
      { id: 5, needId: 'attachment', text: 'Медитация' },
    ]);
    deletePractice.mockResolvedValue({});
    renderScreen();
    await screen.findByText('Медитация');

    fireEvent.click(screen.getByText('удалить'));
    // Первый тап только спрашивает — практика на месте, запроса нет.
    expect(screen.getByText('Медитация')).toBeTruthy();
    expect(deletePractice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Точно удалить?'));
    expect(screen.queryByText('Медитация')).toBeNull();
    expect(deletePractice).toHaveBeenCalledWith(5);
  });

  it('тап по другой практике переносит вопрос на неё и ничего не стирает', async () => {
    getPractices.mockResolvedValue([
      { id: 5, needId: 'attachment', text: 'Медитация' },
      { id: 6, needId: 'attachment', text: 'Прогулка' },
    ]);
    renderScreen();
    await screen.findByText('Медитация');

    const [first, second] = screen.getAllByText('удалить');
    fireEvent.click(first);
    fireEvent.click(second);
    expect(deletePractice).not.toHaveBeenCalled();
    expect(screen.getAllByText('Точно удалить?')).toHaveLength(1);
    expect(screen.getByText('Медитация')).toBeTruthy();
  });

  // Регрессия: сбой удаления глушился `.catch(() => {})` — практика исчезала
  // с экрана, оставаясь в БД, и воскресала при следующем заходе. Теперь сбой
  // показывает ошибку и возвращает список с сервера.
  it('сбой удаления показывает ошибку и возвращает практику в список', async () => {
    getPractices.mockResolvedValue([
      { id: 5, needId: 'attachment', text: 'Медитация' },
    ]);
    deletePractice.mockRejectedValue(new Error('offline'));
    renderScreen();
    await screen.findByText('Медитация');

    fireEvent.click(screen.getByText('удалить'));
    await act(async () => {
      fireEvent.click(screen.getByText('Точно удалить?'));
    });
    expect(screen.getByText('Ошибка сохранения')).toBeTruthy();
    // Список перечитан с сервера — практика на месте, а не исчезла навсегда.
    await screen.findByText('Медитация');
    expect(getPractices.mock.calls.length).toBeGreaterThan(1);
  });
});

// Регрессия: поле «добавить практику» было чистым свободным текстом без
// crisisMarkers — тот же класс дефекта, что закрыт в TaskCreateSheet/LetterEx.
describeCrisisField('webapp/src/components/PracticesScreen.tsx', {
  label: 'добавить практику',
  open: async () => {
    renderScreen();
    await waitFor(() => expect(getPractices).toHaveBeenCalled());
  },
  enter: (text) => fireEvent.change(screen.getByPlaceholderText('Добавить действие…'), { target: { value: text } }),
});

describe('PracticesScreen — ты/вы', () => {
  it('форма «ты»: подсказка про трекер обращается на «ты»', async () => {
    renderScreen('ty');
    expect((await screen.findByText('Открой трекер →')).className).toContain('ds-link--inline');
  });

  it('форма «вы»: подсказка про трекер обращается на «вы», без остаточного «ты»', async () => {
    renderScreen('vy');
    expect(await screen.findByText('Откройте трекер →')).toBeTruthy();
    expect(screen.queryByText('Открой трекер →')).toBeNull();
  });
});
