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
} from '@testing-library/react';
import { ModeMapPalette } from './ModeMapPalette';
import type { TherapistCustomMode } from '../api';

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

function renderPalette(onAdd = vi.fn(), onAddMany = vi.fn()) {
  render(<ModeMapPalette onAdd={onAdd} onAddMany={onAddMany} clientId={7} />);
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
  it('показывает раздел с количеством режимов клиента и разворачивает список по клику', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    renderPalette();
    expect(await screen.findByText('▼ 2', {}, { timeout: 8000 })).toBeTruthy();
    fireEvent.click(screen.getByText('Режимы клиента'));
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Требовательный Критик')).toBeTruthy();
  });

  it('«вынести все» зовёт onAddMany со всеми режимами клиента одним пакетом', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    const { onAddMany } = renderPalette();
    await screen.findByText('▼ 2', {}, { timeout: 8000 });
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
});

describe('ModeMapPalette — свои режимы терапевта', () => {
  it('без своих режимов показывает подсказку-заглушку', async () => {
    renderPalette();
    expect(
      await screen.findByText(
        /Добавь режимы, с которыми/,
        {},
        { timeout: 8000 },
      ),
    ).toBeTruthy();
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
    fireEvent.click(screen.getByText('Сохранить'));
    expect(
      await screen.findByText('Мой режим', {}, { timeout: 8000 }),
    ).toBeTruthy();
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
    const { onAdd } = renderPalette();
    const item = await screen.findByText('Особый', {}, { timeout: 8000 });
    fireEvent.click(item);
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
    renderPalette();
    await screen.findByText('Особый', {}, { timeout: 8000 });
    const row = screen.getByText('Особый').closest('div')!;
    fireEvent.click(
      within(row.parentElement as HTMLElement).getByLabelText('Удалить'),
    );
    expect(deleteCustomMode).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText('Особый')).toBeNull());
  });
});
