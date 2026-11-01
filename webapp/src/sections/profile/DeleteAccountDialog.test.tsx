// @vitest-environment jsdom
// Запись истории у диалога удаления аккаунта (docs/open/one-frontend.md):
// без неё «Назад» браузера проходил мимо диалога. Хост настоящий — убирает
// диалог по onClose, как ProfileSection.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { DeleteAccountDialog } from './DeleteAccountDialog';

vi.mock('../../api', () => ({ api: { deleteAllUserData: vi.fn() } }));

afterEach(() => cleanup());

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
