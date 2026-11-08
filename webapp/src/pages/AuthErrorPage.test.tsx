// @vitest-environment jsdom
// S20 (аудит 2026-11): `/auth/error?reason=` собирается кем угодно — экран
// показывает текст только для кодов из словаря, отчёт админу получает только
// известный код или `unknown`, а чужой текст из адреса в DOM не попадает.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../../shared/src/host', () => ({
  getHost: () => ({ id: 'web', sessionExchange: () => null }),
}));
vi.mock('../api', () => ({ reportClientError: vi.fn() }));

import { reportClientError } from '../api';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { AuthErrorPage } from './AuthErrorPage';

function renderAt(search: string, form: AddressForm = 'ty') {
  window.history.replaceState(null, '', `/auth/error${search}`);
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <AuthErrorPage />
    </AddressFormContext.Provider>,
  );
}

const reportedMessages = () =>
  vi.mocked(reportClientError).mock.calls.map(([p]) => (p as { message: string }).message);

beforeEach(() => vi.mocked(reportClientError).mockClear());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('AuthErrorPage — чужой текст из адреса', () => {
  it('неизвестная причина не попадает в DOM, в отчёт уходит unknown', () => {
    const evil = 'Аккаунт заблокирован, позвоните 8-900-000-00-00';
    const { container } = renderAt(`?reason=${encodeURIComponent(evil)}`);
    expect(container.textContent).not.toContain('8-900');
    expect(container.textContent).not.toContain('заблокирован');
    expect(container.querySelector('.as-reason')).toBeNull();
    expect(screen.getByText('Вход не удался')).toBeTruthy();
    expect(screen.getByText('Попробуй ещё раз или напиши нам в Telegram.')).toBeTruthy();
    expect(reportedMessages()).toHaveLength(1);
    expect(reportedMessages()[0]).toMatch(/, unknown$/);
    expect(reportedMessages()[0]).not.toContain('8-900');
  });

  it('похожее на код, но не из словаря (telegram_mismatch) — тоже общий текст', () => {
    const { container } = renderAt('?reason=telegram_mismatch');
    expect(container.textContent).not.toContain('telegram_mismatch');
    expect(reportedMessages()[0]).toMatch(/, unknown$/);
  });
});

describe('AuthErrorPage — известные коды', () => {
  it('vk_failed: человеческое пояснение, код для поддержки, код в отчёте', () => {
    const { container } = renderAt('?reason=vk_failed');
    expect(screen.getByText(/Вход через ВКонтакте не прошёл/)).toBeTruthy();
    expect(container.querySelector('.as-reason')?.textContent).toBe('vk_failed');
    expect(reportedMessages()[0]).toMatch(/хост=web, .*, vk_failed$/);
  });

  it('email_link_expired в форме «вы» — без «ты»-строк', () => {
    const { container } = renderAt('?reason=email_link_expired', 'vy');
    expect(screen.getByText(/Запросите новую на странице входа/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Запроси |напиши /);
  });

  it('http_429 — про частые попытки; прочий http-статус — общий текст с кодом', () => {
    renderAt('?reason=http_429');
    expect(screen.getByText(/Слишком много попыток подряд/)).toBeTruthy();
    cleanup();
    const { container } = renderAt('?reason=http_403');
    expect(screen.getByText('Попробуй ещё раз или напиши нам в Telegram.')).toBeTruthy();
    expect(container.querySelector('.as-reason')?.textContent).toBe('http_403');
  });

  it('без причины — ни блока с кодом, ни отчёта', () => {
    const { container } = renderAt('');
    expect(container.querySelector('.as-reason')).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
