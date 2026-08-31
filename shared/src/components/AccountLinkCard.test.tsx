// @vitest-environment jsdom
// Карточка объединения аккаунтов — одна на сайт и мини-апп.
//
// Что она обязана сделать ДО первого действия человека (правило онбординга):
// сказать, откуда взялся второй аккаунт и что произойдёт после нажатия. И
// показать КОД в состоянии ожидания: сверка — единственное, что отделяет
// честное объединение от присланной кем-то ссылки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AccountLinkCard } from './AccountLinkCard';
import type { LoginTicketState } from '../auth/useLoginTicket';

afterEach(cleanup);

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;
const idle: LoginTicketState = { kind: 'idle' };
const waiting: LoginTicketState = {
  kind: 'waiting',
  provider: 'google',
  code: 'K7M2QX94',
  url: 'https://schemehappens.ru/link?code=K7M2QX94',
};

function show(over: Partial<Parameters<typeof AccountLinkCard>[0]> = {}) {
  return render(
    <AccountLinkCard
      target="telegram"
      state={idle}
      tr={ty}
      onStart={() => {}}
      onRetry={() => {}}
      {...over}
    />,
  );
}

describe('кому карточка не показывается', () => {
  it('цели нет — не рендерит ничего', () => {
    const { container } = show({ target: null });
    expect(container.textContent).toBe('');
  });

  it('провайдеры ещё грузятся — силуэт, а не пустота и не крутилка', () => {
    const { container } = show({
      loading: true,
      renderSkeleton: () => <div className="skel" />,
    });
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(container.textContent).toBe('');
  });
});

describe('приглашение', () => {
  it('объясняет и откуда это, и что будет после нажатия', () => {
    show();
    expect(screen.getByText(/В боте и мини-аппе Telegram/)).toBeTruthy();
    expect(screen.getByText(/откроется бот и спросит/)).toBeTruthy();
    expect(screen.getByText('Подключить Telegram')).toBeTruthy();
  });

  it('с готовым адресом действие — настоящая ссылка, а не кнопка', () => {
    // Открыть окно после `await` браузеры блокируют, поэтому на сайте адрес
    // обязан быть в разметке до нажатия.
    show({ href: 'https://t.me/Bot?start=link_K7M2QX94' });
    const link = screen.getByText(
      'Подключить Telegram',
    ) as unknown as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toContain('start=link_K7M2QX94');
    expect(link.rel).toContain('noopener');
  });

  it('без адреса — кнопка, которая начинает привязку', () => {
    const onStart = vi.fn();
    show({ onStart });
    fireEvent.click(screen.getByText('Подключить Telegram'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('пока билет выписывается — кнопка погашена, второй запрос не уходит', () => {
    const onStart = vi.fn();
    show({ onStart, state: { kind: 'starting', provider: 'telegram' } });
    const btn = screen.getByText('Подключить Telegram') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('пока билет выписывается — ссылка не открывает второе окно', () => {
    // У <a> нет `disabled`: гасим через aria-disabled + preventDefault, иначе
    // второй тап послал бы второй `start` и сбросил экран в «начинаем».
    const onStart = vi.fn();
    show({
      onStart,
      href: 'https://t.me/Bot?start=link_K7M2QX94',
      state: { kind: 'starting', provider: 'telegram' },
    });
    const link = screen.getByText('Подключить Telegram');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(link);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('в мини-аппе зовёт переносить данные С САЙТА', () => {
    show({ target: 'site' });
    expect(
      screen.getByText(/этот же дневник есть у тебя на сайте/),
    ).toBeTruthy();
    expect(screen.getByText('У меня уже есть аккаунт')).toBeTruthy();
  });
});

describe('ожидание подтверждения', () => {
  it('показывает код в том же виде, что и бот', () => {
    show({ state: waiting });
    expect(screen.getByText('K7M2-QX94')).toBeTruthy();
  });

  it('оставляет полный адрес текстом — на случай, когда браузер не открылся', () => {
    // «Открыть ещё раз» ходит тем же способом, который уже не сработал; без
    // адреса человек остался бы с восьмизначным кодом и без места для него.
    show({ state: waiting });
    expect(screen.getByText(waiting.url)).toBeTruthy();
  });

  it('код копируется по нажатию', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    show({ state: waiting });
    fireEvent.click(screen.getByText('K7M2-QX94'));
    expect(writeText).toHaveBeenCalledWith('K7M2QX94');
  });
});

describe('исходы', () => {
  it('отказ говорит, что доступ никто не получил', () => {
    show({ state: { kind: 'denied' } });
    expect(screen.getByText(/доступ никто не получил/)).toBeTruthy();
  });

  it.each(['expired', 'failed'] as const)('%s — даёт начать заново', (kind) => {
    const onRetry = vi.fn();
    show({ state: { kind }, onRetry });
    fireEvent.click(screen.getByText('Начать заново'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('формы обращения', () => {
  it('в форме «ты» нет ни одной «вы»-строки', () => {
    const { container } = show({ tr: ty });
    expect(container.textContent).not.toMatch(/Подключите|Нажмёте|Подтвердите/);
  });

  it('в форме «вы» нет ни одной «ты»-строки', () => {
    const { container } = show({ tr: vy });
    expect(container.textContent).not.toMatch(/Подключи |Нажмёшь|Подтвердишь/);
  });
});
