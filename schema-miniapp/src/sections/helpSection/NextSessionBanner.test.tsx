// @vitest-environment jsdom
// NextSessionBanner — баннер следующей встречи с терапевтом. Проверяет
// гейт по роли (терапевт сам себе баннер не видит), сегодняшнюю встречу
// (акцентный цвет + «Сегодня встреча») и обычную дату с/без времени.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NextSessionBanner } from './NextSessionBanner';
import type { TherapyRelationInfo } from '../../api';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NextSessionBanner — гейты видимости', () => {
  it('relation отсутствует — ничего не рендерит', () => {
    const { container } = render(<NextSessionBanner relation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('роль "therapist" (не клиент) — баннер скрыт', () => {
    const relation = {
      role: 'therapist',
      nextSession: '2026-08-10',
    } as unknown as TherapyRelationInfo;
    const { container } = render(<NextSessionBanner relation={relation} />);
    expect(container.firstChild).toBeNull();
  });

  it('клиент без назначенной встречи — баннер скрыт', () => {
    const relation = {
      role: 'client',
      nextSession: null,
    } as unknown as TherapyRelationInfo;
    const { container } = render(<NextSessionBanner relation={relation} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('NextSessionBanner — содержимое', () => {
  it('встреча сегодня — акцентный текст «Сегодня встреча»', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T09:00:00Z'));
    const relation = {
      role: 'client',
      nextSession: '2026-08-10',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('Сегодня встреча')).toBeTruthy();
  });

  it('встреча в будущем — дата и время в подписи', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T09:00:00Z'));
    // 2026-08-10 — понедельник
    const relation = {
      role: 'client',
      nextSession: '2026-08-10T15:30:00',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('Встреча: Пн, 10 авг · 15:30:00')).toBeTruthy();
  });

  it('показывает имя партнёра/терапевта, если оно передано', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T09:00:00Z'));
    const relation = {
      role: 'client',
      nextSession: '2026-08-10',
      partnerName: 'Анна Петровна',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('с Анна Петровна')).toBeTruthy();
  });
});
