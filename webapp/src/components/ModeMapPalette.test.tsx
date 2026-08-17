// @vitest-environment jsdom
// ModeMapPalette — левая панель добавления режимов на карту (3% покрытия).
// Чистый React-компонент без @xyflow/react — рендерится напрямую. Проверяем
// поиск, добавление режима по клику, «вынести все режимы клиента» и полный
// CRUD своих режимов терапевта (создание/удаление) — с реальными API-моками.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
  act,
} from '@testing-library/react';
import { ModeMapPalette } from './ModeMapPalette';
import type { TherapistCustomMode } from '../api';
import { AddressFormContext } from '../utils/addressForm';

const getConceptualization = vi.fn();
const listCustomModes = vi.fn();
const createCustomMode = vi.fn();
const deleteCustomMode = vi.fn();
vi.mock('../api', () => ({
  api: {
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    listCustomModes: (...a: unknown[]) => listCustomModes(...a),
    createCustomMode: (...a: unknown[]) => createCustomMode(...a),
    deleteCustomMode: (...a: unknown[]) => deleteCustomMode(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getConceptualization.mockResolvedValue(null);
  listCustomModes.mockResolvedValue([]);
});
afterEach(() => cleanup());

function renderPalette(onAdd = vi.fn(), onAddMany = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <ModeMapPalette onAdd={onAdd} onAddMany={onAddMany} clientId={7} />
    </AddressFormContext.Provider>,
  );
  return { onAdd, onAddMany };
}

describe('ModeMapPalette — поиск и добавление стандартных режимов', () => {
  it('клик по «Триггер / Ситуация» добавляет узел типа trigger', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Триггер / Ситуация'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'trigger',
        data: expect.objectContaining({ label: 'Триггер' }),
      }),
    );
  });

  it('клик по «Поведение / Последствие» добавляет узел типа behavior', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Поведение / Последствие'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'behavior' }),
    );
  });

  it('поиск фильтрует режимы группы по названию', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Поиск режима…'), {
      target: { value: 'Упрямый' },
    });
    expect(screen.getByText('Упрямый Ребёнок')).toBeTruthy();
    expect(screen.queryByText('Одинокий Ребёнок')).toBeNull();
  });

  it('поиск без совпадений показывает «Режим не найден»', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Поиск режима…'), {
      target: { value: 'зюзюзюкод' },
    });
    expect(screen.getByText('Режим не найден')).toBeTruthy();
  });

  it('раскрытие группы показывает её режимы, клик по режиму добавляет узел с копинг-подтипом', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Детские режимы'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'child',
        data: expect.objectContaining({ modeId: 'vulnerable_child' }),
      }),
    );
  });
});

describe('ModeMapPalette — режимы клиента (из концептуализации)', () => {
  // Список режимов клиента приезжает из api.getConceptualization в mount-
  // эффекте — обновление прилетает из-под await, вне act, и опрос findByText
  // (timeout 8000) с ним иногда расходится. Оборачиваем рендер в act(async):
  // он дожидается промиса, дальше ассерт синхронный. Раньше ждали текст
  // «▼ 2» — то же число показывает статичный счётчик группы «Копинг:
  // Капитуляция» (2 стандартных режима), совпадение делает ассерт
  // неоднозначным (getByText падает на нескольких найденных). Само число при
  // этом проверять надо — оно в заголовке названия раздела и есть «сколько
  // режимов у клиента», — поэтому ищем его не по всему документу, а внутри
  // кнопки раздела: там счётчик один.
  it('показывает раздел с количеством режимов клиента и разворачивает список по клику', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    await act(async () => {
      renderPalette();
    });
    const header = screen.getByText('Режимы клиента').closest('button')!;
    expect(within(header).getByText('▼ 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Режимы клиента'));
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Требовательный Критик')).toBeTruthy();
  });

  it('«вынести все» зовёт onAddMany со всеми режимами клиента одним пакетом', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    const onAddMany = vi.fn();
    await act(async () => {
      renderPalette(vi.fn(), onAddMany);
    });
    fireEvent.click(
      screen.getByLabelText('Вынести все режимы клиента на карту'),
    );
    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('пустой список режимов клиента — раздел не рендерится', async () => {
    getConceptualization.mockResolvedValue({ modeIds: [] });
    renderPalette();
    await Promise.resolve();
    expect(screen.queryByText('Режимы клиента')).toBeNull();
  });

  // Регресс: сбой getConceptualization раньше подставлял [] в catch — секция
  // «Режимы клиента» рендерится только при length > 0, поэтому терапевт видел
  // ровно то же самое, что при настоящем «режимов нет» (карта режимов, три
  // молчания). Теперь сбой ≠ пусто: секция видна с текстом отказа.
  it('сбой загрузки режимов клиента — секция видна с текстом отказа, не «раздела нет»', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    await act(async () => {
      renderPalette();
    });
    expect(screen.getByText('Режимы клиента')).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить режимы клиента')).toBeTruthy();
  });
});

describe('ModeMapPalette — свои режимы терапевта', () => {
  it('без своих режимов показывает подсказку-заглушку', async () => {
    // listCustomModes резолвится в mount-эффекте, обновление вне act —
    // ждём его через act(async), а не опросом.
    await act(async () => {
      renderPalette();
    });
    expect(screen.getByText(/Добавь режимы, с которыми/)).toBeTruthy();
  });

  it('в форме «вы» подсказка-заглушка не показывает «ты»', async () => {
    await act(async () => {
      renderPalette(vi.fn(), vi.fn(), 'vy');
    });
    expect(screen.getByText(/Добавьте режимы, с которыми/)).toBeTruthy();
    expect(screen.getByText(/работаете чаще всего/)).toBeTruthy();
  });

  it('создание нового режима: форма → «Сохранить» → появляется в списке', async () => {
    const created: TherapistCustomMode = {
      id: 1,
      therapistId: 1,
      name: 'Мой режим',
      emoji: '🔶',
      nodeType: 'custom',
      createdAt: '2026-01-01',
    };
    createCustomMode.mockResolvedValue(created);
    renderPalette();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.change(screen.getByPlaceholderText('Название…'), {
      target: { value: 'Мой режим' },
    });
    // saveCustomMode ждёт api.createCustomMode — оборачиваем клик в act(async),
    // чтобы дождаться промиса вместо опроса findByText.
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.getByText('Мой режим')).toBeTruthy();
    expect(createCustomMode).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Мой режим' }),
    );
  });

  it('пустое имя не сохраняет режим (createCustomMode не вызывается)', () => {
    renderPalette();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.click(screen.getByText('Сохранить'));
    expect(createCustomMode).not.toHaveBeenCalled();
  });

  it('клик по своему режиму в списке добавляет его на карту', async () => {
    listCustomModes.mockResolvedValue([
      {
        id: 5,
        therapistId: 1,
        name: 'Особый',
        emoji: '⭐',
        nodeType: 'healthy',
        createdAt: '2026-01-01',
      },
    ]);
    const onAdd = vi.fn();
    await act(async () => {
      renderPalette(onAdd);
    });
    fireEvent.click(screen.getByText('Особый'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'healthy',
        data: expect.objectContaining({ label: 'Особый' }),
      }),
    );
  });

  it('удаление своего режима вызывает API и убирает его из списка', async () => {
    listCustomModes.mockResolvedValue([
      {
        id: 5,
        therapistId: 1,
        name: 'Особый',
        emoji: '⭐',
        nodeType: 'custom',
        createdAt: '2026-01-01',
      },
    ]);
    deleteCustomMode.mockResolvedValue(undefined);
    await act(async () => {
      renderPalette();
    });
    const row = screen.getByText('Особый').closest('div')!;
    fireEvent.click(
      within(row.parentElement as HTMLElement).getByLabelText('Удалить'),
    );
    expect(deleteCustomMode).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText('Особый')).toBeNull());
  });

  // Регресс: listCustomModes раньше глушился `.catch(() => {})` — свои режимы
  // терапевта молча не загружались, и панель показывала ту же заглушку-подсказку
  // «Добавь режимы…», что и на честно пустом списке (карта режимов, три молчания).
  it('сбой загрузки своих режимов — видна строка отказа, заглушки «Добавь режимы…» нет', async () => {
    listCustomModes.mockRejectedValue(new Error('offline'));
    await act(async () => {
      renderPalette();
    });
    expect(
      screen.getByText('Не удалось загрузить твои режимы'),
    ).toBeTruthy();
    expect(screen.queryByText(/Добавь режимы, с которыми/)).toBeNull();
  });
});
