// @vitest-environment jsdom
// Исходы /link: «Готово», «Это не я», сводка не загрузилась (wait / our_side). У каждого — выход.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { LinkOutcome } from './LinkOutcome';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderOutcome(node: React.ReactNode, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/link']}>
        <Routes>
          <Route path="/link" element={node} />
          <Route path="/account" element={<div>АККАУНТ</div>} />
        </Routes>
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}
const sign = () => document.querySelector('.pa-outcome-card')?.getAttribute('data-sign');

describe('LinkOutcome', () => {
  it('done: «Готово», ты-форма, кнопка в аккаунт', () => {
    renderOutcome(<LinkOutcome kind="done" messenger="MAX" />);
    expect(screen.getByRole('heading', { name: 'Готово' })).toBeTruthy();
    expect(screen.getByText(/Вернись в приложение/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'В аккаунт' }));
    expect(screen.getByText('АККАУНТ')).toBeTruthy();
  });

  it('done: вы-форма', () => {
    renderOutcome(<LinkOutcome kind="done" messenger="MAX" />, 'vy');
    expect(screen.getByText(/Вернитесь в приложение/)).toBeTruthy();
  });

  it('denied: доступа никто не получил, мессенджер назван, выход в аккаунт', () => {
    renderOutcome(<LinkOutcome kind="denied" messenger="Telegram" />);
    expect(screen.getByRole('heading', { name: 'Доступ никто не получил' })).toBeTruthy();
    expect(screen.getByText(/приложение в Telegram не получило доступ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'В аккаунт' })).toBeTruthy();
  });

  it('wait: текст ошибки — заголовок, знак Cup, без «Повторить»', () => {
    renderOutcome(<LinkOutcome kind="wait" messenger="MAX" error="Код не найден или истёк" />);
    expect(screen.getByRole('heading', { name: 'Код не найден или истёк' })).toBeTruthy();
    expect(sign()).toBe('cup');
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    expect(screen.getByRole('button', { name: 'В аккаунт' })).toBeTruthy();
  });

  it('our_side: «Повторить» перезагружает, тихая ссылка — в аккаунт', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderOutcome(<LinkOutcome kind="our_side" messenger="MAX" error="Сервер не ответил" />);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'В аккаунт' })).toBeTruthy();
  });
});
