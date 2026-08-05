// @vitest-environment jsdom
// SessionCard — часть 1/3 (правило №10 — файл ≤300 строк): дата начала
// терапии (просмотр + редактирование). Дни встреч/бейдж активности — в
// SessionCard.meetingDays.test.tsx; следующая сессия/ошибка — в
// SessionCard.nextSession.test.tsx. Инлайн-редактор с паттерном
// (просмотр → клик → форма → ✓/✕) повторяется во всех трёх частях —
// копипаста, где правку в одной легко забыть внести в другой.
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

describe('SessionCard — дата начала терапии (просмотр)', () => {
  it('therapyStartDate задан — показывает «С {дата}» и длительность', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ therapyStartDate: '2026-01-01' }),
        })}
      />,
    );
    expect(screen.getByText(/^С /)).toBeTruthy();
  });

  it('нет therapyStartDate — используется relationCreatedAt как источник правды', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({
            therapyStartDate: null,
            relationCreatedAt: '2026-01-01',
          }),
        })}
      />,
    );
    expect(screen.getByText(/^С /)).toBeTruthy();
  });

  it('нет ни одной даты — «Начало не указано» вместо пустоты', () => {
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({
            therapyStartDate: null,
            relationCreatedAt: '',
          }),
        })}
      />,
    );
    expect(screen.getByText('Начало не указано')).toBeTruthy();
  });

  it('клик по дате инициализирует localStartDate и включает editingStartDate', () => {
    const setLocalStartDate = vi.fn();
    const setEditingStartDate = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          selectedClient: makeClient({ therapyStartDate: '2026-01-01' }),
          detail: makeDetail({ setLocalStartDate, setEditingStartDate }),
        })}
      />,
    );
    fireEvent.click(screen.getByText(/^С /));
    expect(setLocalStartDate).toHaveBeenCalledWith('2026-01-01');
    expect(setEditingStartDate).toHaveBeenCalledWith(true);
  });
});

describe('SessionCard — редактирование даты начала', () => {
  it('editingStartDate=true — рендерит date-input с localStartDate', () => {
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingStartDate: true,
            localStartDate: '2026-02-01',
          }),
        })}
      />,
    );
    const input = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('2026-02-01');
  });

  it('клик «✓» зовёт saveSessionInfo с therapyStartDate и закрывает форму', async () => {
    const saveSessionInfo = vi.fn().mockResolvedValue(undefined);
    const setEditingStartDate = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingStartDate: true,
            localStartDate: '2026-03-01',
            saveSessionInfo,
            setEditingStartDate,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сохранить'));
    await waitFor(() =>
      expect(saveSessionInfo).toHaveBeenCalledWith({
        therapyStartDate: '2026-03-01',
      }),
    );
    expect(setEditingStartDate).toHaveBeenCalledWith(false);
  });

  it('пустая дата при сохранении отправляет null (снять дату начала)', async () => {
    const saveSessionInfo = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingStartDate: true,
            localStartDate: '',
            saveSessionInfo,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сохранить'));
    await waitFor(() =>
      expect(saveSessionInfo).toHaveBeenCalledWith({ therapyStartDate: null }),
    );
  });

  it('клик «✕» отменяет без сохранения', () => {
    const setEditingStartDate = vi.fn();
    const saveSessionInfo = vi.fn();
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingStartDate: true,
            setEditingStartDate,
            saveSessionInfo,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Отменить'));
    expect(setEditingStartDate).toHaveBeenCalledWith(false);
    expect(saveSessionInfo).not.toHaveBeenCalled();
  });

  it('sessionInfoSaving=true — кнопка «Сохранить» disabled (защита от дубль-сейва)', () => {
    render(
      <SessionCard
        {...baseProps({
          detail: makeDetail({
            editingStartDate: true,
            sessionInfoSaving: true,
          }),
        })}
      />,
    );
    const btn = screen.getByLabelText('Сохранить');
    expect(btn.disabled).toBe(true);
  });
});
