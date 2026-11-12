// @vitest-environment jsdom
// QA 2026-11, М2: «Отвязать» у единственного способа входа была активна —
// подтверждение, затем отказ сервера и общее «Не удалось отвязать».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SignInMethods } from './SignInMethods';
import type { AccountProvider } from './ProviderRows';

afterEach(cleanup);

const p = (provider: AccountProvider['provider']): AccountProvider => ({ provider, email: null, displayName: null });

function renderMethods(providers: AccountProvider[]) {
  render(
    <SignInMethods
      providers={providers} loading={false} busy={false} accessToken="t"
      onLink={{ vk: vi.fn() }} onUnlink={vi.fn()} onError={vi.fn()} onLinked={vi.fn()}
    />,
  );
}

describe('SignInMethods — отвязка', () => {
  it('единственный способ: «Отвязать» недоступна и сказано почему', () => {
    renderMethods([p('google')]);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(screen.getByText(/Единственный способ входа/)).toBeTruthy();
  });

  // QA мобильной версии 2026-11, М9: причина резалась многоточием (.aa-row-sub — одна
  // строка для почты), на телефоне видно было «Единственный способ входа …».
  it('причина недоступной «Отвязать» переносится, а не режется многоточием', () => {
    renderMethods([p('google')]);
    expect(screen.getByText(/Единственный способ входа/).classList.contains('aa-row-why')).toBe(true);
  });

  it('два способа: обе «Отвязать» доступны, пояснения нет', () => {
    renderMethods([p('google'), p('telegram')]);
    const buttons = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Отвязать' });
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(screen.queryByText(/Единственный способ входа/)).toBeNull();
  });

  // Вход через Google убран (2026-11, запрос РКН): привязать его заново
  // нельзя, а прежняя привязка видна и отвязывается, как любая другая.
  it('Google: без привязки строки нет, с прежней привязкой — только «Отвязать»', () => {
    renderMethods([p('telegram')]);
    expect(screen.queryByText('Google')).toBeNull();
    cleanup();
    renderMethods([p('google'), p('email')]);
    const row = screen.getByText('Google').closest('.aa-row') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Отвязать' })).toBeTruthy();
    expect(within(row).queryByText('Привязать')).toBeNull();
  });

  // Вход через Telegram на сайте убран (2026-11, тот же запрос): привязать его
  // отсюда нельзя — ни виджета, ни перехода на oauth.telegram.org; прежняя
  // привязка (аккаунт из бота) видна и отвязывается.
  it('Telegram: без привязки строки и «Привязать» нет, с привязкой — «Отвязать»', () => {
    renderMethods([p('email')]);
    expect(screen.queryByText('Telegram')).toBeNull();
    // «Привязать» осталась только у ВКонтакте (почта уже привязана).
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(1);
    cleanup();
    renderMethods([p('telegram'), p('email')]);
    const row = screen.getByText('Telegram').closest('.aa-row') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Отвязать' })).toBeTruthy();
    expect(within(row).queryByText('Привязать')).toBeNull();
  });

  it('только Telegram: счётчик «1 из 3» — почта и VK ID ещё не добавлены', () => {
    renderMethods([p('telegram')]);
    expect(screen.getByText('1 из 3')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(2);
  });
});
