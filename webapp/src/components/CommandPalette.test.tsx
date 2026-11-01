// @vitest-environment jsdom
// CommandPalette — быстрый поиск/навигация по ⌘K (0% покрытия). Проверяем:
// список пунктов навигации по умолчанию, фильтрацию по вводу, клавиатурную
// навигацию (стрелки/Enter/Escape), клиентов терапевта из API и переключение
// «кабинет терапевта» — денормализованная сборка rows обязана отражать
// therapistMode/userRole без рассинхрона.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { Dialog } from './Dialog';
import type { TherapyClientSummary } from '../api';
import { todayCalendarDate } from '../../../shared/src/utils/calendarDate';
import { forEachTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';

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
  // Палитра кладёт запись истории (useHistorySheet) — нужен роутер.
  return render(
    <MemoryRouter>
      <CommandPalette onNavigate={vi.fn()} onClose={vi.fn()} {...props} />
    </MemoryRouter>,
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
  it('без ввода показывает все пункты навигации клиента', () => {
    renderPalette();
    for (const label of ['Сегодня', 'Записи', 'Ещё', 'Паттерны', 'Профиль', 'Практика']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('клик по пункту навигации зовёт onNavigate с его id и закрывает палитру', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onNavigate, onClose });
    fireEvent.click(screen.getByText('Записи'));
    expect(onNavigate).toHaveBeenCalledWith('diary');
    expect(onClose).toHaveBeenCalled();
  });

  it('в режиме кабинета терапевта (therapistMode) навигация клиента скрыта', () => {
    renderPalette({ therapistMode: true, userRole: 'THERAPIST' });
    expect(screen.queryByText('Записи')).toBeNull();
  });
});

describe('CommandPalette — поиск', () => {
  it('фильтрует пункты по подстроке запроса (регистронезависимо)', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Найти клиента, страницу или действие…'), { target: { value: 'дневник' } });
    expect(screen.getByText('Записи')).toBeTruthy();
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

  it('Escape над диалогом поверх палитры закрывает только диалог', () => {
    const onClose = vi.fn();
    const onCloseDialog = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette onNavigate={vi.fn()} onClose={onClose} />
        <Dialog label="Подтверждение" closeOnEscape onClose={onCloseDialog}>
          <button>ок</button>
        </Dialog>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseDialog).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
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

  // РЕГРЕССИЯ (TZ-класс, инцидент 2026-09-17): `lastActiveDate` — календарный
  // день сервера (полночь UTC), а «сегодня» здесь раньше считалось локальной
  // датой машины (todayStr()). Моменты зафиксированы там, где зоны заведомо
  // расходятся с UTC — иначе тест зеленеет под TZ=UTC и молчит про регресс.
  // Клиент грузится асинхронно (api.getTherapyClients), поэтому первичная
  // загрузка идёт под текущей зоной процесса, а сама проверка по зонам —
  // синхронный пересчёт `rows` (смена текста поиска), чтобы момент смены TZ
  // совпадал с моментом пересчёта «сегодня», а не терялся в микротаске.
  it('клиент, активный сегодня по календарному дню сервера, помечен в любой зоне', async () => {
    const search = () => screen.getByPlaceholderText('Найти клиента, страницу или действие…');
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (const moment of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
        vi.setSystemTime(new Date(moment));
        getTherapyClients.mockResolvedValue([{ ...CLIENT, lastActiveDate: todayCalendarDate() }]);
        const { unmount } = renderPalette({ userRole: 'THERAPIST' });
        await screen.findByText('Иван');

        forEachTimeZone(() => {
          vi.setSystemTime(new Date(moment));
          fireEvent.change(search(), { target: { value: 'ив' } });
          fireEvent.change(search(), { target: { value: '' } });
          // Шов текст ↔ подсветка: цвет раньше выбирался сравнением подписи
          // с литералом, и смена текста молча гасила подсветку.
          expect(screen.getByText('Активность сегодня').classList.contains('is-ok')).toBe(true);
        });

        unmount();
      }
    } finally {
      vi.useRealTimers();
    }
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

describe('CommandPalette — быстрые действия («+» на телефоне)', () => {
  it('показывает действия общего реестра и зовёт onQuickAction с id', () => {
    const onQuickAction = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onQuickAction, onClose });
    fireEvent.click(screen.getByText('Дыхание 4-4-6'));
    expect(onQuickAction).toHaveBeenCalledWith('breathing');
    expect(onClose).toHaveBeenCalled();
  });

  it('действия находятся поиском по названию группы и подписи', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Найти клиента, страницу или действие…'), { target: { value: 'успокоиться' } });
    expect(screen.getByText('Техника «Стоп»')).toBeTruthy();
    expect(screen.queryByText('Трекер потребностей')).toBeNull();
  });

  it('в кабинете терапевта клиентских действий нет', () => {
    renderPalette({ therapistMode: true });
    expect(screen.queryByText('Дыхание 4-4-6')).toBeNull();
  });
});

// Запись истории (docs/open/one-frontend.md, бейслайн history-sheet): палитра
// открывается и с мобильной нижней панели, и «Назад» браузера уводил со
// страницы. Хост здесь настоящий — убирает палитру по onClose, как AppShell.
describe('CommandPalette — «Назад» браузера и запись истории', () => {
  const nav: { back: () => void } = { back: () => {} };
  function BackSpy() {
    const navigate = useNavigate();
    useEffect(() => { nav.back = () => navigate(-1); });
    return null;
  }
  function Host({ onNavigate = vi.fn() }: { onNavigate?: (s: string) => void }) {
    const [open, setOpen] = useState(true);
    return open
      ? <CommandPalette onNavigate={onNavigate} onClose={() => setOpen(false)} />
      : <div>PALETTE-CLOSED</div>;
  }

  it('«Назад» браузера закрывает палитру, а не уводит со страницы', () => {
    render(<MemoryRouter><BackSpy /><Host /></MemoryRouter>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => nav.back());
    expect(screen.getByText('PALETTE-CLOSED')).toBeTruthy();
  });

  it('действие строки идёт после закрытия палитры (запись уже снята)', () => {
    const log: string[] = [];
    function LoggingHost() {
      const [open, setOpen] = useState(true);
      return open
        ? <CommandPalette onNavigate={(s) => log.push('navigate:' + s)} onClose={() => { log.push('close'); setOpen(false); }} />
        : null;
    }
    render(<MemoryRouter><LoggingHost /></MemoryRouter>);
    fireEvent.click(screen.getByText('Записи'));
    expect(log).toEqual(['close', 'navigate:diary']);
  });
});
