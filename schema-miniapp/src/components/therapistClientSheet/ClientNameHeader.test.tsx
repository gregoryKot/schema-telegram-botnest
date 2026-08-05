// @vitest-environment jsdom
// ClientNameHeader — имя клиента в шапке карточки: просмотр ↔ переименование
// (alias) + удаление (0% покрытия). Приоритет отображаемого имени —
// clientAlias > name > «Клиент» — трижды используется по коду (сюда, в
// initInput, в placeholder) и легко рассинхронизировать при правке одного
// места; тест бьёт по каждой ветке приоритета отдельно.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { ClientNameHeader } from './ClientNameHeader';
import type { ClientDetail } from './types';
import type { TherapyClientSummary } from '../../api';

afterEach(() => {
  cleanup();
});

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Иван Петров',
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

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    renamingAlias: false,
    setRenamingAlias: vi.fn(),
    aliasInput: '',
    setAliasInput: vi.fn(),
    aliasSaving: false,
    aliasError: '',
    setAliasError: vi.fn(),
    saveAlias: vi.fn(),
    deleteClient: vi.fn(),
    deleteLoading: false,
    ...overrides,
  } as unknown as ClientDetail;
}

describe('ClientNameHeader — приоритет отображаемого имени', () => {
  it('есть clientAlias — показывает его, не имя', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient({
          clientAlias: 'Клиент А',
          name: 'Иван Петров',
        })}
        detail={makeDetail()}
        aliasInputRef={createRef()}
      />,
    );
    expect(screen.getByText('Клиент А')).toBeTruthy();
    expect(screen.queryByText('Иван Петров')).toBeNull();
  });

  it('нет alias — показывает name', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient({ clientAlias: null, name: 'Иван Петров' })}
        detail={makeDetail()}
        aliasInputRef={createRef()}
      />,
    );
    expect(screen.getByText('Иван Петров')).toBeTruthy();
  });

  it('нет ни alias, ни name — фолбэк «Клиент»', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient({ clientAlias: null, name: null })}
        detail={makeDetail()}
        aliasInputRef={createRef()}
      />,
    );
    expect(screen.getByText('Клиент')).toBeTruthy();
  });
});

describe('ClientNameHeader — переход в режим переименования', () => {
  it('клик «✎» инициализирует поле текущим именем и включает renamingAlias', () => {
    const setAliasInput = vi.fn();
    const setRenamingAlias = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient({ clientAlias: 'Клиент А' })}
        detail={makeDetail({ setAliasInput, setRenamingAlias })}
        aliasInputRef={createRef()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Переименовать'));
    expect(setAliasInput).toHaveBeenCalledWith('Клиент А');
    expect(setRenamingAlias).toHaveBeenCalledWith(true);
  });

  it('клик «🗑» зовёт deleteClient', () => {
    const deleteClient = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({ deleteClient })}
        aliasInputRef={createRef()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Удалить клиента'));
    expect(deleteClient).toHaveBeenCalled();
  });

  it('deleteLoading=true — кнопка удаления disabled', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({ deleteLoading: true })}
        aliasInputRef={createRef()}
      />,
    );
    const btn = screen.getByLabelText('Удалить клиента');
    expect(btn.disabled).toBe(true);
  });
});

describe('ClientNameHeader — режим переименования', () => {
  it('renamingAlias=true — рендерит поле ввода с текущим aliasInput', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({ renamingAlias: true, aliasInput: 'Новое имя' })}
        aliasInputRef={createRef()}
      />,
    );
    const input = screen.getByDisplayValue('Новое имя');
    expect(input).toBeTruthy();
  });

  it('ввод текста зовёт setAliasInput', () => {
    const setAliasInput = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({ renamingAlias: true, setAliasInput })}
        aliasInputRef={createRef()}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'X' } });
    expect(setAliasInput).toHaveBeenCalledWith('X');
  });

  it('Enter в поле зовёт saveAlias', () => {
    const saveAlias = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({ renamingAlias: true, saveAlias })}
        aliasInputRef={createRef()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(saveAlias).toHaveBeenCalled();
  });

  it('клик «✓» зовёт saveAlias, disabled пока aliasSaving', () => {
    const saveAlias = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({
          renamingAlias: true,
          saveAlias,
          aliasSaving: true,
        })}
        aliasInputRef={createRef()}
      />,
    );
    const btn = screen.getByLabelText('Сохранить');
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('...')).toBeTruthy();
  });

  it('клик «✕» отменяет переименование и сбрасывает ошибку', () => {
    const setRenamingAlias = vi.fn();
    const setAliasError = vi.fn();
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({
          renamingAlias: true,
          setRenamingAlias,
          setAliasError,
        })}
        aliasInputRef={createRef()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Отменить'));
    expect(setRenamingAlias).toHaveBeenCalledWith(false);
    expect(setAliasError).toHaveBeenCalledWith('');
  });

  it('aliasError задан — показывает текст ошибки', () => {
    render(
      <ClientNameHeader
        selectedClient={makeClient()}
        detail={makeDetail({
          renamingAlias: true,
          aliasError: 'Слишком длинное имя',
        })}
        aliasInputRef={createRef()}
      />,
    );
    expect(screen.getByText('Слишком длинное имя')).toBeTruthy();
  });
});
