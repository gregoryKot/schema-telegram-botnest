// @vitest-environment jsdom
// ClientListView — часть 1/3 (правило №10 — файл ≤300 строк): контейнер
// (загрузка/пустой список/список клиентов) + кнопка «+» + переключение
// режимов добавления. Режимы «Ссылка»/«Telegram ID» —
// ClientListView.addModeLink.test.tsx, «Оффлайн»/ошибка/выход —
// ClientListView.addModeOffline.test.tsx. Переключение стейтом addMode
// обязано сбрасывать addInput/addError, иначе ошибка/ввод одного режима
// протекает в другой; пустой список — честное сообщение, не нули.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
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

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Клиент',
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...overrides,
  };
}

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

describe('ClientListView — загрузка', () => {
  it('loading=true — скелетон списка, без StatCards/WebBanner (нечего показывать)', () => {
    render(<ClientListView {...baseProps({ loading: true })} />);
    expect(screen.queryByTestId('stat-cards')).toBeNull();
    expect(screen.queryByText('Нет подключённых клиентов.')).toBeNull();
  });
});

describe('ClientListView — пустой список', () => {
  it('нет клиентов — честное сообщение, форма «ты»', () => {
    const { container } = renderWithForm(
      <ClientListView {...baseProps()} />,
      'ty',
    );
    expect(container.textContent).toContain('Нет подключённых клиентов.');
    expect(container.textContent).toContain('Нажми ');
  });

  it('форма «вы» — «Нажмите»', () => {
    const { container } = renderWithForm(
      <ClientListView {...baseProps()} />,
      'vy',
    );
    expect(container.textContent).toContain('Нажмите ');
  });

  it('пустой список — кнопки «Пригласить клиента» внизу нет (только через +)', () => {
    render(<ClientListView {...baseProps()} />);
    expect(screen.queryByText('+ Пригласить клиента')).toBeNull();
  });
});

describe('ClientListView — список клиентов', () => {
  it('рендерит карточку на каждого клиента', () => {
    render(
      <ClientListView
        {...baseProps({
          clients: [
            makeClient({ telegramId: 1, name: 'Аня' }),
            makeClient({ telegramId: 2, name: 'Боря' }),
          ],
        })}
      />,
    );
    const cards = screen.getAllByTestId('client-card');
    expect(cards).toHaveLength(2);
  });

  it('есть клиенты — кнопка «+ Пригласить клиента» внизу видна и открывает invite-режим', () => {
    const openAddMode = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          clients: [makeClient()],
          addClient: makeAddClient({ openAddMode }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('+ Пригласить клиента'));
    expect(openAddMode).toHaveBeenCalledWith('invite');
  });
});

describe('ClientListView — кнопка «+» (открыть форму добавления)', () => {
  it('addMode=null — клик открывает invite-режим', () => {
    const openAddMode = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ openAddMode, addMode: null }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Добавить клиента'));
    expect(openAddMode).toHaveBeenCalledWith('invite');
  });

  it('addMode уже открыт — та же кнопка теперь «Закрыть», клик закрывает', () => {
    const openAddMode = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({ openAddMode, addMode: 'invite' }),
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(openAddMode).toHaveBeenCalledWith(null);
  });
});

describe('ClientListView — переключение режимов добавления', () => {
  it('клик по «Telegram ID» сбрасывает addInput/addError и переключает режим', () => {
    const setAddMode = vi.fn();
    const setAddInput = vi.fn();
    const setAddError = vi.fn();
    render(
      <ClientListView
        {...baseProps({
          addClient: makeAddClient({
            addMode: 'invite',
            setAddMode,
            setAddInput,
            setAddError,
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByText(/Telegram ID/));
    expect(setAddMode).toHaveBeenCalledWith('telegram');
    expect(setAddInput).toHaveBeenCalledWith('');
    expect(setAddError).toHaveBeenCalledWith('');
  });
});
