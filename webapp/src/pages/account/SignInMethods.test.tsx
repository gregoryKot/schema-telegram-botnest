// @vitest-environment jsdom
// QA 2026-11, М2: «Отвязать» у единственного способа входа была активна —
// подтверждение, затем отказ сервера и общее «Не удалось отвязать».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { SignInMethods } from './SignInMethods';
import { EmailLettersGroup } from './EmailLettersGroup';
import { EMAIL_WHY } from './EmailLinkRow';
import type { AccountProvider } from './ProviderRows';

afterEach(cleanup);

const p = (provider: AccountProvider['provider']): AccountProvider => ({ provider, email: null, displayName: null });

const WEB = '1000000000000007'; // веб-аккаунт: без строки входа войти нечем

function renderMethods(providers: AccountProvider[], userId: string | null = WEB) {
  const onLink = { vk: vi.fn(), yandex: vi.fn() };
  const onUnlink = vi.fn();
  render(
    <SignInMethods
      providers={providers} userId={userId} loading={false} busy={false}
      onLink={onLink} onUnlink={onUnlink}
    />,
  );
  return { onLink, onUnlink };
}
const rowOf = (title: string) => screen.getByText(title).closest('.aa-row') as HTMLElement;

describe('SignInMethods — отвязка', () => {
  it('единственный вход: «Отвязать» недоступна и сказано, что привязать', () => {
    renderMethods([p('vk')]);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(screen.getByText('Другого входа в аккаунт нет — отвязать можно, когда привязан Яндекс ID')).toBeTruthy();
  });

  // Вход по почте отключён: почта рядом входом не считается, а её строка — в «Почте для писем».
  it('VK + почта: VK не отвязать; строки почты в способах входа нет', () => {
    renderMethods([p('vk'), p('email')]);
    expect(within(rowOf('ВКонтакте')).getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('аккаунт из Telegram (номер < веб-диапазона) входит через бота: Telegram отвязать можно', () => {
    renderMethods([p('telegram')], '777');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(false);
    expect(screen.queryByText(/Другого входа/)).toBeNull();
  });

  // QA мобильной версии 2026-11, М9: причина резалась многоточием (.aa-row-sub — одна
  // строка для почты), на телефоне видно было «Единственный способ входа …».
  it('причина недоступной «Отвязать» переносится, а не режется многоточием', () => {
    renderMethods([p('google')]);
    expect(screen.getByText(/Другого входа в аккаунт нет/).classList.contains('aa-row-why')).toBe(true);
  });

  it('два входа: обе «Отвязать» доступны, пояснения нет', () => {
    renderMethods([p('vk'), p('telegram')]);
    const buttons = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Отвязать' });
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(screen.queryByText(/Другого входа/)).toBeNull();
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
    // «Привязать» — только у ВКонтакте и Яндекса.
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(2);
    cleanup();
    renderMethods([p('telegram'), p('email')]);
    const row = screen.getByText('Telegram').closest('.aa-row') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Отвязать' })).toBeTruthy();
    expect(within(row).queryByText('Привязать')).toBeNull();
  });

  it('только Telegram: счётчик «1 из 3» — VK ID и Яндекс ID ещё не добавлены', () => {
    renderMethods([p('telegram')]);
    expect(screen.getByText('1 из 3')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Привязать' })).toHaveLength(2);
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
    const { onUnlink } = renderMethods([{ provider: 'yandex', email: 'a@ya.ru', displayName: 'Аня' }, p('telegram')]);
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
    expect(screen.getByText('1 из 2')).toBeTruthy();
  });
});

// Почта — не способ входа (вход по ней отключён, ч. 10 ст. 8 149-ФЗ): строка
// адреса живёт в своей группе «Почта для писем», отвязка — по общему правилу
// (после неё должен остаться вход).
const pe = (provider: AccountProvider['provider'], email: string | null = null): AccountProvider => ({ provider, email, displayName: null });

function renderGroup(providers: AccountProvider[], userId: string | null = WEB) {
  render(
    <EmailLettersGroup providers={providers} userId={userId} loading={false} busy={false}
      accessToken="t" onUnlink={vi.fn()} onLinked={vi.fn()} />,
  );
  return screen.getByRole('heading', { name: 'Почта для писем' }).closest('section') as HTMLElement;
}

describe('EmailLettersGroup', () => {
  it('не привязана: своя группа, «зачем» — про письма, а не про вход', () => {
    const group = renderGroup([pe('vk')]);
    expect(within(group).getByText('Email')).toBeTruthy();
    expect(within(group).getByText(EMAIL_WHY)).toBeTruthy();
    expect(EMAIL_WHY).toMatch(/Входить по почте нельзя/);
    expect(within(group).getByRole('button', { name: 'Привязать' })).toBeTruthy();
  });

  it('привязана рядом с VK ID — адрес и доступная «Отвязать»', () => {
    const group = renderGroup([pe('vk'), pe('email', 'me@example.com')]);
    expect(within(group).getByText('me@example.com')).toBeTruthy();
    expect(within(group).getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(false);
  });

  it('входа нет (почта и прежний Google) — «Отвязать» недоступна, причина под строкой', () => {
    const group = renderGroup([pe('google'), pe('email', 'me@example.com')]);
    expect(within(group).getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(within(group).getByText(/когда привязан VK ID или Яндекс ID$/)).toBeTruthy();
  });
});
