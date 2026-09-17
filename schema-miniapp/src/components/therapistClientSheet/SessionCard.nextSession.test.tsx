// @vitest-environment jsdom
// SessionCard — часть 3/3 (правило №10 — файл ≤300 строк): «следующая
// сессия» + ошибка сохранения. Дата начала — в SessionCard.test.tsx, дни
// встреч/бейдж активности — в SessionCard.meetingDays.test.tsx. Общий сетап
// (makeClient/makeDetail/baseProps) дублируется во всех трёх частях —
// осознанно, чтобы каждый файл был самодостаточным и запускался независимо.
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

describe('SessionCard — следующая сессия (просмотр)', () => {
  it('нет nextSession — «следующая +»', () => {
    render(<SessionCard {...baseProps()} />);
    expect(screen.getByText('следующая +')).toBeTruthy();
  });

  it('nextSession задан — показывает «след.» и форматированную метку', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ nextSession: '2026-08-10T10:00' }),
        })}
      />,
    );
    expect(screen.getByText('след.')).toBeTruthy();
  });

  it('клик по метке инициализирует localNextSession и включает editingNextSession', () => {
    const setLocalNextSession = vi.fn();
    const setEditingNextSession = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ nextSession: '2026-08-10T10:00' }),
          detail: makeDetail({ setLocalNextSession, setEditingNextSession }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('след.'));
    expect(setLocalNextSession).toHaveBeenCalledWith('2026-08-10T10:00');
    expect(setEditingNextSession).toHaveBeenCalledWith(true);
  });
});

describe('SessionCard — редактирование следующей сессии', () => {
  it('клик «✓» сохраняет nextSession и закрывает редактор', async () => {
    const saveSessionInfo = vi.fn().mockResolvedValue(undefined);
    const setEditingNextSession = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingNextSession: true,
            localNextSession: '2026-08-12T09:00',
            saveSessionInfo,
            setEditingNextSession,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сохранить'));
    await waitFor(() =>
      expect(saveSessionInfo).toHaveBeenCalledWith({
        nextSession: '2026-08-12T09:00',
      }),
    );
    expect(setEditingNextSession).toHaveBeenCalledWith(false);
  });

  it('пустое значение при сохранении отправляет null (снять следующую сессию)', async () => {
    const saveSessionInfo = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingNextSession: true,
            localNextSession: '',
            saveSessionInfo,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сохранить'));
    await waitFor(() =>
      expect(saveSessionInfo).toHaveBeenCalledWith({ nextSession: null }),
    );
  });

  it('клик «✕» отменяет без сохранения', () => {
    const setEditingNextSession = vi.fn();
    const saveSessionInfo = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingNextSession: true,
            setEditingNextSession,
            saveSessionInfo,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Отменить'));
    expect(setEditingNextSession).toHaveBeenCalledWith(false);
    expect(saveSessionInfo).not.toHaveBeenCalled();
  });
});

describe('SessionCard — ошибка сохранения', () => {
  it('sessionInfoError задан — показывает текст под карточкой', () => {
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({ sessionInfoError: 'Не удалось сохранить' }),
        })}
      />,
    );
    expect(screen.getByText('Не удалось сохранить')).toBeTruthy();
  });

  it('sessionInfoError пуст — блока ошибки нет', () => {
    render(<SessionCard {...baseProps()} />);
    expect(screen.queryByText('Не удалось сохранить')).toBeNull();
  });
});
