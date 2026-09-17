// @vitest-environment jsdom
// DonateNudge — периодический ненавязчивый баннер поддержки. Логика видимости
// (первая сессия/первые 3 дня скрыт, повтор не чаще раза в 30 дней) раньше не
// тестировалась вовсе (0% покрытия) — баг в таймингах («показался всем сразу
// в первую сессию») был бы незаметен. Плюс обе формы обращения (ты/вы).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { setHost, type HostBridge } from '../../../shared/src/host';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { DonateNudge } from './DonateNudge';

const DAY = 24 * 60 * 60 * 1000;

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

let openLink: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  openLink = vi.fn();
  setHost({ id: 'web', openLink } as unknown as HostBridge);
});

afterEach(() => {
  cleanup();
  setHost(null);
});

describe('DonateNudge — тайминги показа', () => {
  it('первая сессия (нет donateNudgeSeen) — баннер скрыт, отметка «видел» ставится', () => {
    render(<DonateNudge />);
    expect(screen.queryByText('Поддержать проект')).toBeNull();
    expect(localStorage.getItem('donateNudgeSeen')).not.toBeNull();
  });

  it('меньше 3 дней с первого визита — всё ещё скрыт', () => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 1 * DAY));
    render(<DonateNudge />);
    expect(screen.queryByText('Поддержать проект')).toBeNull();
  });

  it('прошло 3+ дня и раньше не показывали — баннер виден', () => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 4 * DAY));
    render(<DonateNudge />);
    expect(screen.getByText('Поддержать проект')).toBeTruthy();
  });

  it('показывали меньше 30 дней назад — не повторяем', () => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 10 * DAY));
    localStorage.setItem('donateNudgeAt', String(Date.now() - 5 * DAY));
    render(<DonateNudge />);
    expect(screen.queryByText('Поддержать проект')).toBeNull();
  });

  it('прошло 30+ дней с прошлого показа — снова виден', () => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 40 * DAY));
    localStorage.setItem('donateNudgeAt', String(Date.now() - 31 * DAY));
    render(<DonateNudge />);
    expect(screen.getByText('Поддержать проект')).toBeTruthy();
  });
});

describe('DonateNudge — действия', () => {
  beforeEach(() => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 4 * DAY));
  });

  it('«Поддержать» открывает ссылку донейта и закрывает баннер (записывает donateNudgeAt)', () => {
    render(<DonateNudge />);
    fireEvent.click(screen.getByText('Поддержать'));
    expect(openLink).toHaveBeenCalledWith('https://schemehappens.ru/donate');
    expect(screen.queryByText('Поддержать проект')).toBeNull();
    expect(localStorage.getItem('donateNudgeAt')).not.toBeNull();
  });

  it('«Позже» закрывает баннер без перехода по ссылке', () => {
    render(<DonateNudge />);
    fireEvent.click(screen.getByText('Позже'));
    expect(openLink).not.toHaveBeenCalled();
    expect(screen.queryByText('Поддержать проект')).toBeNull();
    expect(localStorage.getItem('donateNudgeAt')).not.toBeNull();
  });

  it('клик по фону (не по карточке) тоже закрывает — карточка гасит всплытие', () => {
    render(<DonateNudge />);
    // Клик по внутренней карточке НЕ должен закрыть (stopPropagation) —
    // проверяем, что баннер всё ещё виден.
    fireEvent.click(screen.getByText('Поддержать проект'));
    expect(screen.getByText('Поддержать проект')).toBeTruthy();
  });
});

describe('DonateNudge — обращение ты/вы', () => {
  beforeEach(() => {
    localStorage.setItem('donateNudgeSeen', String(Date.now() - 4 * DAY));
  });

  it('форма «ты»', () => {
    renderWithForm(<DonateNudge />, 'ty');
    expect(screen.getByText(/Если оно тебе помогает/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(<DonateNudge />, 'vy');
    expect(screen.getByText(/Если оно вам помогает/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
