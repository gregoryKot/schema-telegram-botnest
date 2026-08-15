// @vitest-environment jsdom
// ClientListView — часть 3/3 (правило №10 — файл ≤300 строк): режим
// добавления «Оффлайн» (виртуальный клиент), ошибка добавления, выход из
// режима терапевта. Остальные режимы — в ClientListView.test.tsx и
// ClientListView.addModeLink.test.tsx. Дочерние карточки/статы/баннеры
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
    inviteCopyFailed: false,
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

describe('ClientListView — режим «Оффлайн» (виртуальный клиент)', () => {
  it('пустое имя — кнопка «Создать» disabled', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'virtual', addInput: '' }),
        })}
      />,
    );
    const btn = screen.getByText('Создать');
    expect(btn.disabled).toBe(true);
  });

  it('имя введено — клик зовёт addVirtualClient', () => {
    const addVirtualClient = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'virtual',
            addInput: 'Иван',
            addVirtualClient,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Создать'));
    expect(addVirtualClient).toHaveBeenCalled();
  });

  it('Enter в поле имени зовёт addVirtualClient', () => {
    const addVirtualClient = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'virtual', addVirtualClient }),
        })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Имя клиента'), {
      key: 'Enter',
    });
    expect(addVirtualClient).toHaveBeenCalled();
  });
});

describe('ClientListView — ошибка добавления', () => {
  it('addError задан — показывает текст ошибки', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'telegram',
            addError: 'Клиент не найден',
          }),
        })}
      />,
    );
    expect(screen.getByText('Клиент не найден')).toBeTruthy();
  });
});

describe('ClientListView — выход из режима терапевта', () => {
  it('клик по «✕» в шапке зовёт onClose', () => {
    const onClose = vi.fn();
    render(<ClientListView {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Вернуться в приложение'));
    expect(onClose).toHaveBeenCalled();
  });
});
