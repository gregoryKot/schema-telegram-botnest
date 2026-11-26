// @vitest-environment jsdom
// Подтверждение кодом 2FA для ручек привязки/отвязки (S12, аудит 2026-11):
// 403 totp_required → окно кода → тот же запрос с `x-totp-code`; 429
// totp_locked → текст про паузу и резервный код; без 2FA — всё как раньше.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { StepUpProvider } from './StepUpProvider';
import { useStepUpFetch, type StepUpSend } from './stepUpContext';

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const NEED = () => res(403, { message: 'Нужен код двухфакторной защиты', reason: 'totp_required' });

type Outcome = { value?: Response | null; error?: unknown };

function Probe({ send, out }: { send: StepUpSend; out: Outcome[] }) {
  const stepUp = useStepUpFetch();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => { stepUp(send).then((value) => out.push({ value }), (error: unknown) => out.push({ error })); }}>go</button>
      <button onClick={() => navigate(-1)}>browser-back</button>
    </>
  );
}

function setup(send: StepUpSend, form: AddressForm = 'ty', withProvider = true) {
  const out: Outcome[] = [];
  const probe = <Probe send={send} out={out} />;
  render(
    <MemoryRouter initialEntries={['/account']}>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        {withProvider ? <StepUpProvider>{probe}</StepUpProvider> : probe}
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('go'));
  return out;
}

const typeApp = (v: string) => fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value: v } });
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
// Окно появилось, и его запись в истории (useHistorySheet) уже легла — как у
// человека, который не успевает нажать «Отмена» в тот же такт.
async function dialogOpen() {
  const dialog = await screen.findByRole('dialog');
  await act(() => new Promise((r) => setTimeout(r, 0)));
  return dialog;
}

afterEach(cleanup);

describe('StepUpProvider — без 2FA', () => {
  it('ответ без «нужен код» отдаётся сразу, окна нет, код не шлётся', async () => {
    const send = vi.fn().mockResolvedValue(res(200, { ok: true }));
    const out = setup(send);
    await waitFor(() => expect(out).toHaveLength(1));
    expect(out[0].value?.status).toBe(200);
    expect(send).toHaveBeenCalledWith();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('чужой 403 (не totp_required) — тоже как есть', async () => {
    const out = setup(vi.fn().mockResolvedValue(res(403, { reason: 'csrf' })));
    await waitFor(() => expect(out[0]?.value?.status).toBe(403));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('StepUpProvider — код из приложения', () => {
  it('403 totp_required → окно кода, повтор того же запроса с кодом, исход — после закрытия окна', async () => {
    const send = vi.fn((code?: string) => Promise.resolve(code === '123456' ? res(200, { ok: true }) : NEED()));
    const out = setup(send);
    await screen.findByText('Подтверди, что это ты');
    const input = screen.getByLabelText('Код из приложения');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect((screen.getByRole('button', { name: 'Подтвердить' }) as HTMLButtonElement).disabled).toBe(true);
    typeApp('123456');
    confirm();
    await waitFor(() => expect(out).toHaveLength(1));
    expect(out[0].value?.status).toBe(200);
    expect(send).toHaveBeenLastCalledWith('123456');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('неверный код — «Код не подошёл», поле очищено, окно на месте', async () => {
    const send = vi.fn((code?: string) => Promise.resolve(code === '654321' ? res(200) : NEED()));
    const out = setup(send);
    await dialogOpen();
    typeApp('111111');
    confirm();
    await screen.findByText(/Код не подошёл\. Проверь его/);
    expect((screen.getByLabelText('Код из приложения') as HTMLInputElement).value).toBe('');
    typeApp('654321');
    confirm();
    await waitFor(() => expect(out[0]?.value?.status).toBe(200));
  });

  it('«Отмена» — действие отменено (null), повторного запроса нет', async () => {
    const send = vi.fn().mockResolvedValue(NEED());
    const out = setup(send);
    await dialogOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(out).toEqual([{ value: null }]));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('«Назад» браузера закрывает окно и отменяет действие', async () => {
    const out = setup(vi.fn().mockResolvedValue(NEED()));
    await dialogOpen();
    act(() => { fireEvent.click(screen.getByText('browser-back')); });
    await waitFor(() => expect(out).toEqual([{ value: null }]));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('сеть упала на повторе — ошибка уходит вызывающему', async () => {
    const send = vi.fn((code?: string) => (code ? Promise.reject(new TypeError('Load failed')) : Promise.resolve(NEED())));
    const out = setup(send);
    await dialogOpen();
    typeApp('123456');
    confirm();
    await waitFor(() => expect(out[0]?.error).toBeInstanceOf(TypeError));
  });
});

describe('StepUpProvider — резервный код и пауза', () => {
  it('ссылка «использовать резервный код» меняет поле; резервный код уходит тем же заголовком', async () => {
    const send = vi.fn((code?: string) => Promise.resolve(code === 'ab12cd34ef' ? res(200) : NEED()));
    const out = setup(send);
    await dialogOpen();
    expect(screen.getByText(/Введи код из приложения-аутентификатора/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Использовать резервный код' }));
    // Подводка — про резервный код: «код из приложения» над его полем было бы неправдой.
    expect(screen.getByText(/Введи один из резервных кодов — каждый срабатывает один раз/)).toBeTruthy();
    expect(screen.queryByText(/приложения-аутентификатора/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Резервный код'), { target: { value: 'AB12 cd34-EF' } });
    confirm();
    await waitFor(() => expect(out[0]?.value?.status).toBe(200));
    expect(send).toHaveBeenLastCalledWith('ab12cd34ef');
  });

  it('лид следует за режимом поля: резервный код — без просьбы открыть приложение, и обратно', async () => {
    setup(vi.fn().mockResolvedValue(NEED()), 'vy');
    const dialog = await dialogOpen();
    expect(dialog.textContent).toContain('Введите код из приложения-аутентификатора.');
    fireEvent.click(screen.getByRole('button', { name: 'Использовать резервный код' }));
    expect(dialog.textContent).toContain('Введите один из резервных кодов — каждый срабатывает один раз.');
    expect(dialog.textContent).not.toContain('аутентификатор');
    fireEvent.click(screen.getByRole('button', { name: 'Ввести код из приложения' }));
    expect(dialog.textContent).toContain('Введите код из приложения-аутентификатора.');
  });

  it('429 totp_locked — текст про паузу, поле сразу резервного кода', async () => {
    const send = vi.fn((code?: string) =>
      Promise.resolve(code === '000000' ? res(429, { reason: 'totp_locked', retryAfter: 1800 }) : NEED()));
    setup(send);
    await dialogOpen();
    typeApp('000000');
    confirm();
    await screen.findByText(/Слишком много неверных кодов подряд.*попробуй через 30 мин\./);
    expect(screen.getByLabelText('Резервный код')).toBeTruthy();
  });

  it('форма «вы» — без «ты»-строк', async () => {
    setup(vi.fn().mockResolvedValue(NEED()), 'vy');
    const dialog = await dialogOpen();
    expect(dialog.textContent).toContain('Подтвердите, что это вы');
    expect(dialog.textContent).not.toMatch(/Введи |У тебя/);
  });
});

describe('useStepUpFetch без провайдера', () => {
  it('запрос уходит как раньше, 403 отдаётся вызывающему', async () => {
    const out = setup(vi.fn().mockResolvedValue(NEED()), 'ty', false);
    await waitFor(() => expect(out[0]?.value?.status).toBe(403));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
