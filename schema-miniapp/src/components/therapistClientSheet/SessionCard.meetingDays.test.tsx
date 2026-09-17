// @vitest-environment jsdom
// SessionCard — часть 2/2 (правило №10 — файл ≤300 строк): бейдж активности
// клиента + дни встреч (просмотр/редактирование). Начало терапии — в
// SessionCard.test.tsx, следующая сессия/ошибка — в
// SessionCard.nextSession.test.tsx. Гейт «дни встреч скрывают форму
// следующей сессии, пока открыты» проверяется здесь же (обе части рядом).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { createRef } from 'react';
import { SessionCard } from './SessionCard';
import type { ClientDetail } from './types';
import type { TherapyClientSummary } from '../../api';

afterEach(() => {
  cleanup();
});

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Клиент',
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    editingDays: false,
    setEditingDays: vi.fn(),
    localMeetingDays: [] as number[],
    setLocalMeetingDays: vi.fn(),
    editingStartDate: false,
    setEditingStartDate: vi.fn(),
    localStartDate: '',
    setLocalStartDate: vi.fn(),
    editingNextSession: false,
    setEditingNextSession: vi.fn(),
    localNextSession: '',
    setLocalNextSession: vi.fn(),
    sessionInfoSaving: false,
    sessionInfoError: '',
    saveSessionInfo: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ClientDetail;
}

function baseProps(overrides: Partial<Parameters<typeof SessionCard>[0]> = {}) {
  return {
    selectedClient: makeClient(),
    today: '2026-08-05',
    detail: makeDetail(),
    startDateInputRef: createRef<HTMLInputElement>(),
    nextSessionInputRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
}

describe('SessionCard — бейдж активности', () => {
  it('lastActiveDate = today — «● сегодня»', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ lastActiveDate: '2026-08-05' }),
          today: '2026-08-05',
        })}
      />,
    );
    expect(screen.getByText('● сегодня')).toBeTruthy();
  });

  it('lastActiveDate ≠ today — показывает дату последней активности', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ lastActiveDate: '2026-08-01' }),
          today: '2026-08-05',
        })}
      />,
    );
    expect(screen.queryByText('● сегодня')).toBeNull();
  });

  it('telegramId ≤ 0 (тестовый/системный клиент) — бейдж активности не рендерится', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({
            telegramId: -1,
            lastActiveDate: '2026-08-05',
          }),
          today: '2026-08-05',
        })}
      />,
    );
    expect(screen.queryByText('● сегодня')).toBeNull();
  });
});

describe('SessionCard — дни встреч (просмотр)', () => {
  it('нет дней — «дни встреч +»', () => {
    render(<SessionCard {...baseProps()} />);
    expect(screen.getByText('дни встреч +')).toBeTruthy();
  });

  it('дни заданы — показывает их метки в фиксированном порядке пн→вс', () => {
    render(
      <SessionCard
        {...baseProps({ selectedClient: makeClient({ meetingDays: [1, 3] }) })}
      />,
    );
    expect(screen.getByText('Пн')).toBeTruthy();
    expect(screen.getByText('Ср')).toBeTruthy();
  });

  it('клик по дням инициализирует localMeetingDays и включает editingDays', () => {
    const setLocalMeetingDays = vi.fn();
    const setEditingDays = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ meetingDays: [2] }),
          detail: makeDetail({ setLocalMeetingDays, setEditingDays }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Вт'));
    expect(setLocalMeetingDays).toHaveBeenCalledWith([2]);
    expect(setEditingDays).toHaveBeenCalledWith(true);
  });
});

describe('SessionCard — редактирование дней встреч', () => {
  it('клик по дню тогглит его в localMeetingDays (добавление)', () => {
    const setLocalMeetingDays = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingDays: true,
            localMeetingDays: [1],
            setLocalMeetingDays,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Ср'));
    const updater = setLocalMeetingDays.mock.calls[0][0] as (
      p: number[],
    ) => number[];
    expect(updater([1])).toEqual([1, 3]);
  });

  it('клик по уже выбранному дню убирает его (снятие)', () => {
    const setLocalMeetingDays = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingDays: true,
            localMeetingDays: [1, 3],
            setLocalMeetingDays,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Ср'));
    const updater = setLocalMeetingDays.mock.calls[0][0] as (
      p: number[],
    ) => number[];
    expect(updater([1, 3])).toEqual([1]);
  });

  it('клик «✓» сохраняет meetingDays и закрывает редактор', async () => {
    const saveSessionInfo = vi.fn().mockResolvedValue(undefined);
    const setEditingDays = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingDays: true,
            localMeetingDays: [1, 5],
            saveSessionInfo,
            setEditingDays,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сохранить'));
    await waitFor(() =>
      expect(saveSessionInfo).toHaveBeenCalledWith({ meetingDays: [1, 5] }),
    );
    expect(setEditingDays).toHaveBeenCalledWith(false);
  });

  it('editingDays=true — форма следующей сессии скрыта (гейт «!editingDays &&»)', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ nextSession: '2026-08-10T10:00' }),
          detail: makeDetail({ editingDays: true }),
        })}
      />,
    );
    expect(screen.queryByText('след.')).toBeNull();
    expect(screen.queryByText('следующая +')).toBeNull();
  });
});
