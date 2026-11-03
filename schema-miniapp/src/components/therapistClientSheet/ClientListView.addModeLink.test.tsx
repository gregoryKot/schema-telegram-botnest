// @vitest-environment jsdom
// ClientListView — часть 2/3 (правило №10 — файл ≤300 строк): режимы
// добавления клиента «Ссылка». Общий контейнер и режим
// «Оффлайн»/ошибки — в ClientListView.test.tsx и
// ClientListView.addModeOffline.test.tsx. Дочерние карточки/статы/баннеры
// покрыты своими тестами — мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createRef } from 'react';
import { ClientListView } from './ClientListView';
import { useAddClient } from '../therapist/useAddClient';
import type { ClientDetail, AddClient } from './types';
import type { TherapyClientSummary } from '../../api';

vi.mock('../../api', () => ({
  api: {
    createTherapyInvite: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])),
    revokeTherapyInvite: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as {
  createTherapyInvite: ReturnType<typeof vi.fn>;
};

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
    invite: null,
    setInvite: vi.fn(),
    pending: {
      invites: [],
      reload: vi.fn(),
      revoke: vi.fn(),
      revokeFailed: null,
    },
    inviteCopied: false,
    inviteCopyFailed: false,
    inviteLoading: false,
    inviteInputRef: createRef(),
    openAddMode: vi.fn(),
    createInvite: vi.fn(),
    copyInvite: vi.fn(),
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
    safeTop: 0,
    animKey: 0,
    onClose: vi.fn(),
    virtualInputRef: createRef<HTMLInputElement>(),
    detail: makeDetail(),
    addClient: makeAddClient(),
    ...overrides,
  };
}

describe('ClientListView — режим «Ссылка»', () => {
  it('нет приглашения — кнопка «Создать ссылку» зовёт createInvite', () => {
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

  it('приглашение создано — поле ссылки, код отдельно, кнопки копирования и «Создать новую»', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            invite: { url: 'https://t.me/bot?x=1', code: '7F3A9C21B04E' },
          }),
        })}
      />,
    );
    expect(screen.getByDisplayValue('https://t.me/bot?x=1')).toBeTruthy();
    expect(screen.getByText('Скопировать')).toBeTruthy();
    expect(screen.getByTestId('invite-share')).toBeTruthy();
    // Инцидент 2026-10-26: код был только внутри ссылки t.me.
    expect(screen.getByText('7F3A9C21B04E')).toBeTruthy();
    expect(screen.getByText('Скопировать код')).toBeTruthy();
    expect(screen.getByText(/«Мой терапевт»/)).toBeTruthy();
  });

  it('клик «Скопировать» зовёт copyInvite', () => {
    const copyInvite = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            invite: { url: 'https://t.me/bot?x=1', code: '7F3A9C21B04E' },
            copyInvite,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Скопировать'));
    expect(copyInvite).toHaveBeenCalled();
  });

  it('клик «Создать новую» сбрасывает приглашение (новое — со своим кодом)', () => {
    const setInvite = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            invite: { url: 'https://t.me/bot?x=1', code: '7F3A9C21B04E' },
            setInvite,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('Создать новую'));
    expect(setInvite).toHaveBeenCalledWith(null);
  });

  it('inviteCopyFailed=true — виден отказ (был: молча проглочен)', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            invite: { url: 'https://t.me/bot?x=1', code: '7F3A9C21B04E' },
            inviteCopyFailed: true,
          }),
        })}
      />,
    );
    expect(screen.getByText(/Не удалось скопировать/)).toBeTruthy();
  });

  it('имя в поле приглашения — необязательное, ведётся через addInput', () => {
    const setAddInput = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ addMode: 'invite', setAddInput }),
        })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Имя клиента'), {
      target: { value: 'Мария К.' },
    });
    expect(setAddInput).toHaveBeenCalledWith('Мария К.');
  });

  it('живые приглашения — блок «Ждут подключения» с именем', () => {
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            pending: {
              invites: [
                {
                  id: 1,
                  code: '7F3A9C21B04E',
                  url: 'https://t.me/b?startapp=therapy_7F3A9C21B04E',
                  alias: 'Мария К.',
                  createdAt: '2026-10-26T10:00:00.000Z',
                  expiresAt: '2026-11-02T10:00:00.000Z',
                },
              ],
              reload: vi.fn(),
              revoke: vi.fn(),
              revokeFailed: null,
            },
          }),
        })}
      />,
    );
    expect(screen.getByText('Ждут подключения · 1')).toBeTruthy();
    expect(screen.getByText('Мария К.')).toBeTruthy();
  });

  // РЕГРЕССИЯ (парный баг webapp/AddClientForm.test.tsx): ссылка-приглашение
  // копировалась молча — при отказе clipboard.writeText терапевт не видел
  // отказа. Бьёт через РЕАЛЬНЫЙ useAddClient, а не мок addClient, чтобы
  // проверить связку хук→компонент, а не только рендер по флагу.
  function RealHost() {
    const addClient = useAddClient({ setClients: vi.fn() });
    return <ClientListView {...baseProps({ addClient })} />;
  }

  it('реальный useAddClient: клипборд падает — надпись видна на экране', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/bot?x=real',
      code: '7F3A9C21B04E',
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(<RealHost />);
    fireEvent.click(screen.getByLabelText('Добавить клиента'));
    fireEvent.click(screen.getByText('Ссылка'));
    await act(async () => {
      fireEvent.click(screen.getByText('Создать ссылку'));
    });
    await screen.findByDisplayValue('https://t.me/bot?x=real');
    await act(async () => {
      fireEvent.click(screen.getByText('Скопировать'));
    });

    await screen.findByText(/Не удалось скопировать/);
    expect(screen.queryByText('✓ Скопировано')).toBeNull();
  });
});
