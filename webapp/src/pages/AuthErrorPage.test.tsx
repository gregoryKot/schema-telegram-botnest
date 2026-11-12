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
    expect(container.querySelector('.pa-outcome-code')).toBeNull();
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
    expect(container.querySelector('.pa-outcome-code')?.textContent).toBe('vk_failed');
    expect(reportedMessages()[0]).toMatch(/хост=web, .*, vk_failed$/);
  });

  it('email_link_expired в форме «вы» — без «ты»-строк', () => {
    const { container } = renderAt('?reason=email_link_expired', 'vy');
    expect(screen.getByText(/Запросите новую\./)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Запроси |напиши /);
  });

  it('http_429 — про частые попытки; прочий http-статус — общий текст с кодом', () => {
    renderAt('?reason=http_429');
    expect(screen.getByText(/Слишком много попыток подряд/)).toBeTruthy();
    cleanup();
    const { container } = renderAt('?reason=http_403');
    expect(screen.getByText('Попробуй ещё раз или напиши нам в Telegram.')).toBeTruthy();
    expect(container.querySelector('.pa-outcome-code')?.textContent).toBe('http_403');
  });

  // b26: лист исхода по коду — устаревшая ссылка «подожди» (Cup), отказ сервера — граница (Limits);
  // залитая кнопка одна, «Написать» — тихой ссылкой.
  it('исход по коду и одна залитая кнопка', () => {
    const { container } = renderAt('?reason=email_link_expired');
    expect(container.querySelector('.pa-outcome-card')?.getAttribute('data-sign')).toBe('cup');
    expect(container.querySelectorAll('.ds-btn')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Запросить новую ссылку' }).className).toContain('ds-btn');
    expect(screen.getByRole('link', { name: 'Написать' }).className).toContain('pa-quiet');
    cleanup();
    const { container: refused } = renderAt('?reason=http_403');
    expect(refused.querySelector('.pa-outcome-card')?.getAttribute('data-sign')).toBe('limits');
  });

  it('без причины — ни блока с кодом, ни отчёта', () => {
    const { container } = renderAt('');
    expect(container.querySelector('.pa-outcome-code')).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});

// U6 (аудит 2026-11): просроченная ссылка показывала «Вход не удался» с
// техническим кодом, а «Попробовать снова» вела на общий вход, где форму почты
// надо было искать заново; обрыв сети выглядел так же, как просрочка.
describe('AuthErrorPage — ссылка из письма', () => {
  it('просрочка: «Ссылка устарела», без кода, кнопка ведёт сразу к форме почты', () => {
    const { container } = renderAt('?reason=email_link_expired');
    expect(screen.getByRole('heading').textContent).toBe('Ссылка устарела');
    expect(screen.getByText(/открывается только один раз\. Запроси новую\./)).toBeTruthy();
    expect(container.querySelector('.pa-outcome-code')).toBeNull();
    const link = screen.getByText('Запросить новую ссылку') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/login?via=email');
    expect(reportedMessages()[0]).toMatch(/, email_link_expired$/);
  });

  it('обрыв сети: «Нет связи» и свой текст, а не «ссылка устарела»', () => {
    const { container } = renderAt('?reason=email_network');
    expect(screen.getByRole('heading').textContent).toBe('Нет связи');
    expect(screen.getByText('Нет связи, попробуй ещё раз: проверь интернет и снова открой ссылку из письма.')).toBeTruthy();
    expect(container.textContent).not.toContain('устарел');
    expect(reportedMessages()[0]).toMatch(/, email_network$/);
  });

  it('обрыв сети на «вы»', () => {
    renderAt('?reason=email_network', 'vy');
    expect(screen.getByText(/попробуйте ещё раз: проверьте интернет и снова откройте ссылку/)).toBeTruthy();
  });
});

// Рубильник VK (2026-11): вместо голого 500 — свой экран с честной
// причиной и кнопкой к другим способам входа.
describe('AuthErrorPage — провайдер выключен', () => {
  it('vk_disabled: свой заголовок, кнопка на /login, без кода, код в отчёте', () => {
    const { container } = renderAt('?reason=vk_disabled');
    expect(screen.getByRole('heading').textContent).toBe('Вход через ВКонтакте отключён');
    expect(screen.getByText(/временно отключён/)).toBeTruthy();
    const link = screen.getByText('Другой способ входа') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/login');
    expect(container.querySelector('.pa-outcome-code')).toBeNull();
    expect(reportedMessages()[0]).toMatch(/, vk_disabled$/);
  });

  // Вход через Google убран (2026-11): его кодов сервер больше не ставит.
  it('google_disabled — неизвестная причина: общий экран', () => {
    renderAt('?reason=google_disabled');
    expect(screen.getByRole('heading').textContent).toBe('Вход не удался');
  });

  it('vk_disabled в форме «вы» — тот же безличный текст', () => {
    const { container } = renderAt('?reason=vk_disabled', 'vy');
    expect(screen.getByRole('heading').textContent).toBe('Вход через ВКонтакте отключён');
    expect(container.textContent).not.toMatch(/Попробуй|напиши/);
  });
});
