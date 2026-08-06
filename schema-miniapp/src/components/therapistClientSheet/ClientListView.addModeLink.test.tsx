// @vitest-environment jsdom
// ClientListView — часть 2/3 (правило №10 — файл ≤300 строк): режимы
// добавления клиента «Ссылка» и «Telegram ID». Общий контейнер и режим
// «Оффлайн»/ошибки — в ClientListView.test.tsx и
// ClientListView.addModeOffline.test.tsx. Дочерние карточки/статы/баннеры
// покрыты своими тестами — мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { ClientListView } from './ClientListView';
import type { ClientDetail, AddClient } from './types';
import type { TherapyClientSummary } from '../../api';

vi.mock('./ClientCard', () => ({
  ClientCard: ({ client }: { client: TherapyClientSummary }) => (
    <div data-testid="client-card">{client.name}</div>
  ),
}));
vi.mock('./StatCards', () => ({
  StatCards: () => <div data-testid="stat-cards" />,
}));
vi.mock('../WebBanner', () => ({
  WebBanner: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('../../share/TherapistInviteShare', () => ({
  TherapistInviteShare: () => <div data-testid="invite-share" />,
}));

afterEach(() => {
  cleanup();
});

function makeAddClient(overrides: Partial<AddClient> = {}): AddClient {
  return {
    addMode: null,
    setAddMode: vi.fn(),
    addInput: '',
    setAddInput: vi.fn(),
    addError: '',
    setAddError: vi.fn(),
    inviteUrl: '',
    setInviteUrl: vi.fn(),
    inviteCopied: false,
    setInviteCopied: vi.fn(),
    inviteLoading: false,
    inviteInputRef: createRef(),
    openAddMode: vi.fn(),
    createInvite: vi.fn(),
    copyInvite: vi.fn(),
    addByTelegramId: vi.fn(),
    addVirtualClient: vi.fn(),
    addLoading: false,
    ...overrides,
  } as unknown as AddClient;
}

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    openClient: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

function baseProps(
  overrides: Partial<Parameters<typeof ClientListView>[0]> = {},
) {
  return {
    clients: [] as TherapyClientSummary[],
    loading: false,
    today: '2026-08-05',
    safeTop: 0,
    animKey: 0,
    onClose: vi.fn(),
    telegramInputRef: createRef<HTMLInputElement>(),
    virtualInputRef: createRef<HTMLInputElement>(),
    detail: makeDetail(),
    addClient: makeAddClient(),
    ...overrides,
  };
}

describe('ClientListView — режим «Ссылка»', () => {
  it('нет inviteUrl — кнопка «Создать ссылку» зовёт createInvite', () => {
    const createInvite = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'invite', createInvite }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Создать ссылку'));
    expect(createInvite).toHaveBeenCalled();
  });

  it('inviteLoading=true — кнопка показывает «Создаю...»', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'invite', inviteLoading: true }),
        })}
      />,
    );
    expect(screen.getByText('Создаю...')).toBeTruthy();
  });

  it('inviteUrl задан — показывает поле ссылки, кнопки копирования и «Создать новую»', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            inviteUrl: 'https://t.me/bot?x=1',
          }),
        })}
      />,
    );
    expect(screen.getByDisplayValue('https://t.me/bot?x=1')).toBeTruthy();
    expect(screen.getByText('Скопировать')).toBeTruthy();
    expect(screen.getByTestId('invite-share')).toBeTruthy();
  });

  it('клик «Скопировать» зовёт copyInvite', () => {
    const copyInvite = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            inviteUrl: 'https://t.me/bot?x=1',
            copyInvite,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Скопировать'));
    expect(copyInvite).toHaveBeenCalled();
  });

  it('клик «Создать новую» сбрасывает inviteUrl и inviteCopied', () => {
    const setInviteUrl = vi.fn();
    const setInviteCopied = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            inviteUrl: 'https://t.me/bot?x=1',
            setInviteUrl,
            setInviteCopied,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Создать новую'));
    expect(setInviteUrl).toHaveBeenCalledWith('');
    expect(setInviteCopied).toHaveBeenCalledWith(false);
  });
});

describe('ClientListView — режим «Telegram ID»', () => {
  it('пустой ввод — кнопка «Добавить» disabled', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'telegram', addInput: '' }),
        })}
      />,
    );
    const btn = screen.getByText('Добавить');
    expect(btn.disabled).toBe(true);
  });

  it('ввод введён — кнопка активна, клик зовёт addByTelegramId', () => {
    const addByTelegramId = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'telegram',
            addInput: '12345',
            addByTelegramId,
          }),
        })}
      />,
    );
    const btn = screen.getByText('Добавить');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(addByTelegramId).toHaveBeenCalled();
  });

  it('Enter в поле зовёт addByTelegramId', () => {
    const addByTelegramId = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'telegram', addByTelegramId }),
        })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Telegram ID клиента'), {
      key: 'Enter',
    });
    expect(addByTelegramId).toHaveBeenCalled();
  });
});
