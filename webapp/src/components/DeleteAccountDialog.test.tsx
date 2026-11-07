// @vitest-environment jsdom
// Диалог удаления аккаунта — один на «Профиль» и «Настройки → Данные».
// Запись истории (docs/open/one-frontend.md): без неё «Назад» браузера
// проходил мимо диалога. Хост настоящий — убирает диалог по onClose.
// QA 2026-11, К2: копия в «Профиле» не знала про код 2FA и не чистила
// хранилище — здесь оба пути на том единственном диалоге, что остался.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { hasAuthSeen, markAuthSeen } from '../../../shared/src/auth/authSeen';
import { isAccountJustDeleted } from '../../../shared/src/account/accountDeletion';

vi.mock('../api', () => ({ api: { deleteAllUserData: vi.fn() } }));
import { api } from '../api';
const deleteAll = api.deleteAllUserData as unknown as ReturnType<typeof vi.fn>;

const originalLocation = window.location;
let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  reload = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
  localStorage.clear();
  sessionStorage.clear();
  deleteAll.mockReset();
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

const nav: { back: () => void } = { back: () => {} };
function BackSpy() {
  const navigate = useNavigate();
  useEffect(() => { nav.back = () => navigate(-1); });
  return null;
}

function Host() {
  const [open, setOpen] = useState(true);
  return open ? <DeleteAccountDialog onClose={() => setOpen(false)} /> : <div>DIALOG-CLOSED</div>;
}

function renderHost() {
  render(<MemoryRouter><BackSpy /><Host /></MemoryRouter>);
  expect(screen.getByText('Удалить аккаунт?')).toBeTruthy();
}

describe('DeleteAccountDialog — история', () => {
  it('«Назад» браузера закрывает диалог', () => {
    renderHost();
    act(() => nav.back());
    expect(screen.getByText('DIALOG-CLOSED')).toBeTruthy();
  });

  it('«Отмена» закрывает через снятие записи истории (goBack), а не мимо неё', () => {
    renderHost();
    fireEvent.click(screen.getByText('Отмена'));
    expect(screen.getByText('DIALOG-CLOSED')).toBeTruthy();
  });
});

describe('DeleteAccountDialog — удаление', () => {
  it('успех: хранилище вычищено (кроме темы), экран входа узнает про удаление, страница перезагружена', async () => {
    deleteAll.mockResolvedValue(undefined);
    markAuthSeen();
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    renderHost();
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(hasAuthSeen()).toBe(false);
    expect(localStorage.getItem('therapy_contact_url')).toBeNull();
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(isAccountJustDeleted()).toBe(true);
  });

  it('включена 2FA: 403 totp_required → поле кода, повтор с кодом (а не «проверьте соединение»)', async () => {
    deleteAll
      .mockRejectedValueOnce(Object.assign(new Error('Нужен код'), { status: 403, reason: 'totp_required' }))
      .mockResolvedValueOnce(undefined);
    renderHost();
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    const input = await screen.findByLabelText(/двухфакторная/);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(deleteAll).toHaveBeenLastCalledWith('123456');
  });

  it('сбой сети: видно, что данные на месте; хранилище не тронуто', async () => {
    deleteAll.mockRejectedValue(new Error('network'));
    markAuthSeen();
    renderHost();
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Данные на месте/);
    expect(reload).not.toHaveBeenCalled();
    expect(hasAuthSeen()).toBe(true);
  });
});
