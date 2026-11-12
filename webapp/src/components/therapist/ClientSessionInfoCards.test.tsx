// @vitest-environment jsdom
// «Следующая сессия» и строка «Встреча» в шапке не показывают прошедшую дату: при днях
// встреч она переезжает на ближайший такой день (2026-10: «Сб, 17 окт» при
// сегодняшнем 26-м). Логика переноса — shared/src/therapy/upcomingSession.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NextSessionCard, StartDateCard } from './ClientSessionInfoCards';
import { ClientHeaderBadges } from './ClientHeaderBadges';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T12:00:00Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const client = (o: Partial<TherapyClientSummary>) =>
  ({ telegramId: -1, streak: 0, meetingDays: [], nextSession: null, ...o }) as unknown as TherapyClientSummary;
const detail = (setLocalNextSession = vi.fn()) =>
  ({ editingNextSession: false, setEditingNextSession: vi.fn(), setLocalNextSession }) as unknown as ClientDetail;

describe('ближайшая сессия в карточке клиента', () => {
  it('прошедшая дата при еженедельной субботе — ближайшая суббота, правка начинается с неё', () => {
    const setLocal = vi.fn();
    render(<NextSessionCard selectedClient={client({ nextSession: '2026-10-17T07:00', meetingDays: [6] })} detail={detail(setLocal)} />);
    expect(screen.getByText('Сб, 31 окт · 07:00')).toBeTruthy();
    expect(screen.queryByText(/17 окт/)).toBeNull();
    fireEvent.click(screen.getByText('Изменить →'));
    expect(setLocal).toHaveBeenCalledWith('2026-10-31T07:00');
  });

  it('прошедшая дата без дней встреч — «Не установлена», строки «Встреча» в шапке нет', () => {
    const c = client({ nextSession: '2026-10-17T07:00' });
    render(<><NextSessionCard selectedClient={c} detail={detail()} /><ClientHeaderBadges client={c} /></>);
    // Незаполненное — тихо (--text-sub через tk-meet-none), не крупным текстом на тёмной плитке (b30).
    expect(screen.getByText('Не установлена').className).toBe('tk-meet-none');
    expect(screen.queryByText('Встреча')).toBeNull();
  });

  it('строка «Встреча» в шапке показывает ту же ближайшую дату', () => {
    render(<ClientHeaderBadges client={client({ nextSession: '2026-10-17T07:00', meetingDays: [6] })} />);
    expect(screen.getByText('Встреча')).toBeTruthy();
    expect(screen.getByText('Сб, 31 окт · 07:00')).toBeTruthy();
  });

  it('«Начало терапии»: без даты — «Не указана» и «Указать →», с датой — «Изменить →»', () => {
    const setLocal = vi.fn();
    const d = { editingStartDate: false, setEditingStartDate: vi.fn(), setLocalStartDate: setLocal } as unknown as ClientDetail;
    const { unmount } = render(<StartDateCard selectedClient={client({ therapyStartDate: null })} detail={d} />);
    expect(screen.getByText('Не указана').className).toBe('tk-meet-none');
    fireEvent.click(screen.getByText('Указать →'));
    expect(setLocal).toHaveBeenCalledWith('');
    unmount();
    render(<StartDateCard selectedClient={client({ therapyStartDate: '2026-01-15' })} detail={d} />);
    fireEvent.click(screen.getByText('Изменить →'));
    expect(setLocal).toHaveBeenCalledWith('2026-01-15');
  });

  it('«Начало терапии» в правке — поле даты с lang="ru"; значение — ISO, как и без lang', () => {
    const d = { editingStartDate: true, localStartDate: '2026-01-15', setEditingStartDate: vi.fn(), setLocalStartDate: vi.fn(), saveSessionInfo: vi.fn() } as unknown as ClientDetail;
    render(<StartDateCard selectedClient={client({ therapyStartDate: '2026-01-15' })} detail={d} />);
    const input = screen.getByLabelText('Начало терапии') as HTMLInputElement;
    expect(input.lang).toBe('ru');
    expect(input.value).toBe('2026-01-15');
  });
});
