// @vitest-environment jsdom
// CommandPalette — быстрый поиск/навигация по ⌘K (0% покрытия). Проверяем:
// список пунктов навигации по умолчанию, фильтрацию по вводу, клавиатурную
// навигацию (стрелки/Enter/Escape), клиентов терапевта из API и переключение
// «кабинет терапевта» — денормализованная сборка rows обязана отражать
// therapistMode/userRole без рассинхрона.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import type { TherapyClientSummary } from '../api';

const getTherapyClients = vi.fn();
vi.mock('../api', () => ({
  api: { getTherapyClients: (...a: unknown[]) => getTherapyClients(...a) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getTherapyClients.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

function renderPalette(props: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  return render(
    <CommandPalette onNavigate={vi.fn()} onClose={vi.fn()} {...props} />,
  );
}

describe('CommandPalette — диалог (К4)', () => {
  // К4 дизайн-аудита 2026-08: панель — role="dialog"/aria-modal.
  it('панель размечена как диалог', () => {
    renderPalette();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

describe('CommandPalette — навигация', () => {
  it('без ввода показывает все 5 пунктов навигации клиента', () => {
    renderPalette();
    for (const label of ['Сегодня', 'Дневник', 'Паттерны', 'Профиль', 'Практика']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('клик по пункту навигации зовёт onNavigate с его id и закрывает палитру', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onNavigate, onClose });
    fireEvent.click(screen.getByText('Дневник'));
    expect(onNavigate).toHaveBeenCalledWith('diary');
    expect(onClose).toHaveBeenCalled();
  });

  it('в режиме кабинета терапевта (therapistMode) навигация клиента скрыта', () => {
    renderPalette({ therapistMode: true, userRole: 'THERAPIST' });
    expect(screen.queryByText('Дневник')).toBeNull();
  });
});

describe('CommandPalette — поиск', () => {
  it('фильтрует пункты по подстроке запроса (регистронезависимо)', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Найти клиента, страницу или действие…'), { target: { value: 'дневник' } });
    expect(screen.getByText('Дневник')).toBeTruthy();
    expect(screen.queryByText('Сегодня')).toBeNull();
  });

  it('пустой результат поиска показывает «Ничего не найдено»', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Найти клиента, страницу или действие…'), { target: { value: 'zzz-нет-такого' } });
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });
});

describe('CommandPalette — клавиатура', () => {
  it('Escape закрывает палитру', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Enter выполняет действие выбранной (по умолчанию первой) строки', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onNavigate, onClose });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('today');
    expect(onClose).toHaveBeenCalled();
  });

  it('ArrowDown двигает выделение на следующую строку перед Enter', () => {
    const onNavigate = vi.fn();
    renderPalette({ onNavigate });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('diary');
  });
});

describe('CommandPalette — клиенты терапевта', () => {
  const CLIENT: TherapyClientSummary = {
    telegramId: 42, name: 'Иван', clientAlias: null, streak: 3,
    lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
    relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null,
  };

  it('загружает и показывает клиентов только для роли THERAPIST', async () => {
    getTherapyClients.mockResolvedValue([CLIENT]);
    renderPalette({ userRole: 'THERAPIST' });
    expect(await screen.findByText('Иван')).toBeTruthy();
  });

  it('для роли CLIENT не запрашивает список клиентов', () => {
    renderPalette({ userRole: 'CLIENT' });
    expect(getTherapyClients).not.toHaveBeenCalled();
  });

  it('клик по клиенту зовёт onOpenClient с его telegramId', async () => {
    getTherapyClients.mockResolvedValue([CLIENT]);
    const onOpenClient = vi.fn();
    renderPalette({ userRole: 'THERAPIST', onOpenClient });
    await screen.findByText('Иван');
    fireEvent.click(screen.getByText('Иван'));
    expect(onOpenClient).toHaveBeenCalledWith(42);
  });
});

describe('CommandPalette — фон', () => {
  it('клик по затемнённому фону закрывает палитру', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});
