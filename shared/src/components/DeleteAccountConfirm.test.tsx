// @vitest-environment jsdom
// Финальный шаг удаления аккаунта: без 2FA — одна кнопка; с 2FA сервер просит
// код (403 totp_required) — появляется поле, запрос повторяется с кодом.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';

afterEach(cleanup);

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;
const needCodeErr = () =>
  Object.assign(new Error('x'), { status: 403, reason: 'totp_required' });

function Harness(p: {
  del: (code?: string) => Promise<void>;
  tr?: (a: string, b: string) => string;
  onDeleted?: () => void;
  onFailed?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <DeleteAccountConfirm
      tr={p.tr ?? ty}
      deleting={deleting}
      setDeleting={setDeleting}
      deleteAllUserData={p.del}
      onDeleted={p.onDeleted ?? (() => {})}
      onFailed={p.onFailed ?? (() => {})}
    />
  );
}

const confirm = () => screen.getByText(/Да, удалить всё навсегда|Удаляем/);

describe('DeleteAccountConfirm', () => {
  it('без 2FA: одна кнопка, кода нет, запрос без кода, затем onDeleted', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<Harness del={del} onDeleted={onDeleted} />);
    expect(screen.queryByLabelText(/код/i)).toBeNull();
    fireEvent.click(confirm());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledWith(undefined);
  });

  it('403 totp_required → поле кода; кнопка неактивна, пока код короче 6; повтор уходит с кодом', async () => {
    const del = vi
      .fn()
      .mockRejectedValueOnce(needCodeErr())
      .mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();
    const onFailed = vi.fn();
    render(<Harness del={del} onDeleted={onDeleted} onFailed={onFailed} />);
    fireEvent.click(confirm());
    const input = await screen.findByLabelText(/двухфакторная/i);
    expect(onFailed).not.toHaveBeenCalled();
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: '123456' } });
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenLastCalledWith('123456');
  });

  it('неверный код → «Код не подошёл», поле остаётся, onDeleted не зовётся', async () => {
    const del = vi.fn().mockRejectedValue(needCodeErr());
    const onDeleted = vi.fn();
    render(<Harness del={del} onDeleted={onDeleted} />);
    fireEvent.click(confirm());
    const input = await screen.findByLabelText(/двухфакторная/i);
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(confirm());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Код не подошёл/);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/двухфакторная/i)).toBeTruthy();
  });

  it('другая ошибка (сеть) → onFailed, поля кода нет', async () => {
    const del = vi.fn().mockRejectedValue(new Error('network down'));
    const onFailed = vi.fn();
    render(<Harness del={del} onFailed={onFailed} />);
    fireEvent.click(confirm());
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(/двухфакторная/i)).toBeNull();
  });

  it('обе формы обращения: «вы» не видит «ты» и наоборот', async () => {
    const del = vi.fn().mockRejectedValue(needCodeErr());
    const { unmount } = render(<Harness del={del} tr={vy} />);
    fireEvent.click(confirm());
    await screen.findByLabelText(/двухфакторная/i);
    expect(document.body.textContent).toMatch(/У вас включена/);
    expect(document.body.textContent).not.toMatch(/У тебя/);
    unmount();
    render(<Harness del={del} tr={ty} />);
    fireEvent.click(confirm());
    await screen.findByLabelText(/двухфакторная/i);
    expect(document.body.textContent).toMatch(/У тебя включена/);
  });
});
