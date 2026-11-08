// @vitest-environment jsdom
// U6 (аудит 2026-11): после «Письмо отправлено» был только «Ввести другой
// email» — ни подсказки про «Спам», ни повторной отправки; со «Ссылка
// устарела» человек попадал на общий вход и искал форму почты заново.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { LoginEmailForm } from './LoginEmailForm';
import { EMAIL_FORM_PATH } from '../service/authErrorScreens';
import { AUTH_RETURN_KEY } from '../../auth/returnTo';

const fetchMock = vi.fn();
const ok = () => ({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });

function renderForm(path = '/login', form: 'ty' | 'vy' = 'ty') {
  const setError = vi.fn();
  const utils = render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <LoginEmailForm setError={setError} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return { ...utils, setError };
}

async function sendOnce(container: HTMLElement) {
  fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
  await act(async () => { fireEvent.submit(container.querySelector('form')!); });
}

const linkCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/email/link'));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  fetchMock.mockReset().mockResolvedValue(ok());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LoginEmailForm — письмо отправлено', () => {
  it('подсказывает про «Спам» в обеих формах', async () => {
    const { container } = renderForm(EMAIL_FORM_PATH);
    await sendOnce(container);
    expect(screen.getByText('Письма нет? Проверь папку «Спам»')).toBeTruthy();
    cleanup();
    const vy = renderForm(EMAIL_FORM_PATH, 'vy');
    await sendOnce(vy.container);
    expect(screen.getByText('Письма нет? Проверьте папку «Спам»')).toBeTruthy();
  });

  it('«Отправить ещё раз» — после паузы 60 с с обратным отсчётом, тот же запрос', async () => {
    const { container } = renderForm(EMAIL_FORM_PATH);
    await sendOnce(container);
    const resend = () => screen.getByRole('button', { name: /Отправить ещё раз/ }) as HTMLButtonElement;
    expect(resend().textContent).toBe('Отправить ещё раз через 60 с');
    expect(resend().disabled).toBe(true);

    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(resend().textContent).toBe('Отправить ещё раз через 45 с');
    fireEvent.click(resend());
    expect(linkCalls()).toHaveLength(1); // пока идёт пауза — не шлём

    await act(async () => { vi.advanceTimersByTime(45_000); });
    expect(resend().disabled).toBe(false);
    expect(resend().textContent).toBe('Отправить ещё раз');
    await act(async () => { fireEvent.click(resend()); });

    expect(linkCalls()).toHaveLength(2);
    expect(JSON.parse(linkCalls()[1][1].body as string)).toEqual({ email: 'me@example.com' });
    expect(screen.getByText('Письмо отправлено ещё раз')).toBeTruthy();
    expect(resend().textContent).toBe('Отправить ещё раз через 60 с'); // пауза заново
  });

  // E14 (аудит 2026-11): письмо открывают новой вкладкой, где sessionStorage пуст.
  it('запомненный адрес возврата уходит в запросе письма; длинный или с // — не уходит', async () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '/link?code=ABCD2345');
    const { container } = renderForm(EMAIL_FORM_PATH);
    await sendOnce(container);
    expect(JSON.parse(linkCalls()[0][1].body as string)).toEqual({ email: 'me@example.com', returnTo: '/link?code=ABCD2345' });
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBe('/link?code=ABCD2345'); // вкладка свой адрес не теряет
    cleanup();
    for (const path of [`/${'a'.repeat(600)}`, '/x?next=https://a.b']) {
      sessionStorage.setItem(AUTH_RETURN_KEY, path);
      fetchMock.mockClear();
      const r = renderForm(EMAIL_FORM_PATH);
      await sendOnce(r.container);
      expect(JSON.parse(linkCalls()[0][1].body as string)).toEqual({ email: 'me@example.com' });
      cleanup();
    }
    sessionStorage.clear();
  });

  it('повтор упал (лимит сервера) — ошибка видна, экран «отправлено» остаётся', async () => {
    const { container, setError } = renderForm(EMAIL_FORM_PATH);
    await sendOnce(container);
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({ message: 'Слишком много запросов' }) });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Отправить ещё раз' })); });
    expect(setError).toHaveBeenLastCalledWith(expect.any(String));
    expect(setError.mock.lastCall?.[0]).toBeTruthy();
    expect(screen.getByText('Письмо отправлено')).toBeTruthy();
  });
});

describe('LoginEmailForm — переход со «Ссылка устарела»', () => {
  it('?via=email открывает форму почты сразу', () => {
    renderForm(EMAIL_FORM_PATH);
    expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
  });

  it('без параметра — сначала кнопка «Войти по email»', () => {
    renderForm('/login');
    expect(screen.queryByPlaceholderText('your@email.com')).toBeNull();
    expect(screen.getByRole('button', { name: 'Войти по email' })).toBeTruthy();
  });
});
