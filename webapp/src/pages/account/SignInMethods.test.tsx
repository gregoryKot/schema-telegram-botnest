// @vitest-environment jsdom
// QA 2026-11, М2: «Отвязать» у единственного способа входа была активна —
// подтверждение, затем отказ сервера и общее «Не удалось отвязать».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { SignInMethods } from './SignInMethods';
import type { AccountProvider } from './ProviderRows';

afterEach(cleanup);

const p = (provider: AccountProvider['provider']): AccountProvider => ({ provider, email: null, displayName: null });

function renderMethods(providers: AccountProvider[]) {
  const onLink = { vk: vi.fn(), yandex: vi.fn() };
  const onUnlink = vi.fn();
  render(
    <SignInMethods
      providers={providers} loading={false} busy={false} accessToken="t"
      onLink={onLink} onUnlink={onUnlink} onLinked={vi.fn()}
    />,
  );
  return { onLink, onUnlink };
}
const rowOf = (title: string) => screen.getByText(title).closest('.aa-row') as HTMLElement;

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
    // «Привязать» осталась только у ВКонтакте и Яндекса (почта уже привязана).
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(2);
    cleanup();
    renderMethods([p('telegram'), p('email')]);
    const row = screen.getByText('Telegram').closest('.aa-row') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Отвязать' })).toBeTruthy();
    expect(within(row).queryByText('Привязать')).toBeNull();
  });

  it('только Telegram: счётчик «1 из 4» — почта, VK ID и Яндекс ID ещё не добавлены', () => {
    renderMethods([p('telegram')]);
    expect(screen.getByText('1 из 4')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(3);
  });
});

// Яндекс ID (2026-11) — зеркало ВКонтакте: строка есть всегда, «Привязать»
// уводит на свой маршрут, привязанный отвязывается общим механизмом.
describe('SignInMethods — Яндекс', () => {
  it('строка стоит сразу за ВКонтакте; «Привязать» зовёт привязку Яндекса, а не VK', () => {
    const { onLink } = renderMethods([p('email')]);
    const titles = [...document.querySelectorAll('.aa-row-title')].map((e) => e.textContent);
    expect(titles.slice(0, 2)).toEqual(['ВКонтакте', 'Яндекс']);
    fireEvent.click(within(rowOf('Яндекс')).getByRole('button', { name: 'Привязать' }));
    expect(onLink.yandex).toHaveBeenCalledTimes(1);
    expect(onLink.vk).not.toHaveBeenCalled();
  });

  it('привязанный: имя из аккаунта Яндекса, «Отвязать» уходит с id yandex', () => {
    const { onUnlink } = renderMethods([{ provider: 'yandex', email: 'a@ya.ru', displayName: 'Аня' }, p('email')]);
    const row = rowOf('Яндекс');
    expect(within(row).getByText('Аня')).toBeTruthy();
    expect(within(row).queryByText('Привязать')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Отвязать' }));
    expect(onUnlink).toHaveBeenCalledWith('yandex');
  });

  it('без имени — почта аккаунта; единственный способ — «Отвязать» недоступна', () => {
    renderMethods([{ provider: 'yandex', email: 'a@ya.ru', displayName: null }]);
    const row = rowOf('Яндекс');
    expect(within(row).getByText('a@ya.ru')).toBeTruthy();
    expect(within(row).getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(screen.getByText('1 из 3')).toBeTruthy();
  });
});
