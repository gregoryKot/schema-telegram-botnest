// @vitest-environment jsdom
// РЕГРЕССИЯ: офлайн-клиенты определялись по `!name`, а бэкенд отдаёт им name
// (имя из карточки) и отрицательный telegramId — они попадали в таблицу
// Telegram-клиентов с пустым индексом и статусом «не активен».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TherapyClientSummary } from '../../api';
import { RosterRow } from './RosterRow';

afterEach(cleanup);

const base: TherapyClientSummary = {
  telegramId: 1,
  name: 'Аня',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: 6.5,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: '2026-10-07T11:00',
  meetingDays: [],
  schemaIds: [],
};

describe('RosterRow', () => {
  it('офлайн-клиент с непустым name: подпись «оффлайн», индекса нет', () => {
    render(<RosterRow client={{ ...base, telegramId: -5, name: 'Борис' }} today="2026-10-03" showState onOpen={vi.fn()} />);
    expect(screen.getByText('Борис')).toBeTruthy();
    expect(screen.getByText('оффлайн')).toBeTruthy();
    expect(screen.queryByText('6.5')).toBeNull();
    expect(screen.queryByText('не активен')).toBeNull();
  });

  it('Telegram-клиент: индекс, подпись активности и встреча', () => {
    render(<RosterRow client={base} today="2026-10-03" showState onOpen={vi.fn()} />);
    expect(screen.getByText('6.5')).toBeTruthy();
    expect(screen.getByText('не активен')).toBeTruthy();
    expect(screen.getByText('Ср, 7 окт · 11:00')).toBeTruthy();
  });

  it('без колонки самочувствия индекс не рисуется', () => {
    render(<RosterRow client={base} today="2026-10-03" showState={false} onOpen={vi.fn()} />);
    expect(screen.queryByText('6.5')).toBeNull();
  });
});
