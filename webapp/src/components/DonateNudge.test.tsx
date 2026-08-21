// @vitest-environment jsdom
// DonateNudge — периодическое ненавязчивое напоминание поддержать проект
// (0% покрытия). Логика видимости целиком завязана на localStorage —
// денормализованное состояние (SEEN_KEY/SHOWN_KEY), которое обязано вести
// себя предсказуемо: новый юзер, юзер младше 3 дней и юзер, которому
// недавно показывали, — не видят баннер.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DonateNudge } from './DonateNudge';

const SHOWN_KEY = 'donateNudgeAt';
const SEEN_KEY = 'donateNudgeSeen';
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderNudge() {
  return render(
    <MemoryRouter>
      <DonateNudge />
    </MemoryRouter>,
  );
}

describe('DonateNudge — видимость', () => {
  it('совсем новый юзер (SEEN_KEY не установлен) не видит баннер, но метка проставляется', () => {
    renderNudge();
    expect(screen.queryByText('Поддержать проект')).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBeTruthy();
  });

  it('юзер младше 3 дней с момента первого визита не видит баннер', () => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - DAY)); // 1 день назад
    renderNudge();
    expect(screen.queryByText('Поддержать проект')).toBeNull();
  });

  it('юзер старше 3 дней, баннер ещё не показывали — видит баннер', () => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - 5 * DAY));
    renderNudge();
    expect(screen.getByText('Поддержать проект')).toBeTruthy();
  });

  it('баннер недавно показывали (< 30 дней) — не показывает снова', () => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - 10 * DAY));
    localStorage.setItem(SHOWN_KEY, String(Date.now() - DAY));
    renderNudge();
    expect(screen.queryByText('Поддержать проект')).toBeNull();
  });

  it('с момента последнего показа прошло больше 30 дней — показывает снова', () => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - 60 * DAY));
    localStorage.setItem(SHOWN_KEY, String(Date.now() - 31 * DAY));
    renderNudge();
    expect(screen.getByText('Поддержать проект')).toBeTruthy();
  });

  // К4 дизайн-аудита 2026-08: панель — role="dialog"/aria-modal.
  it('видимая панель размечена как диалог', () => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - 60 * DAY));
    localStorage.setItem(SHOWN_KEY, String(Date.now() - 31 * DAY));
    renderNudge();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

describe('DonateNudge — закрытие', () => {
  beforeEach(() => {
    localStorage.setItem(SEEN_KEY, String(Date.now() - 5 * DAY));
  });

  it('«Позже» закрывает баннер и фиксирует момент показа', () => {
    renderNudge();
    fireEvent.click(screen.getByText('Позже'));
    expect(screen.queryByText('Поддержать проект')).toBeNull();
    expect(localStorage.getItem(SHOWN_KEY)).toBeTruthy();
  });

  it('клик по «Поддержать» ведёт на /donate', () => {
    renderNudge();
    const link = screen.getByText('Поддержать') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/donate');
  });
});
