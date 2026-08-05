// @vitest-environment jsdom
// ClientDetailView — экран одного клиента в кабинете терапевта (0%
// покрытия). Дочерние блоки (SessionCard/ClinicalSnapshot/ActionButtons/
// WebBanner/ClientNameHeader) покрыты своими тестами — здесь мокаем их и
// проверяем то, что принадлежит именно контейнеру: кнопка «Назад» сбрасывает
// И вид, И два флага редактирования (renamingAlias/ysqRequested) — забытый
// сброс флага раньше оставлял открытую форму переименования при возврате
// к тому же клиенту.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { ClientDetailView } from './ClientDetailView';
import type { ClientDetail } from './types';
import type { TherapyClientSummary } from '../../api';

vi.mock('./SessionCard', () => ({
  SessionCard: () => <div data-testid="session-card" />,
}));
vi.mock('./ClinicalSnapshot', () => ({
  ClinicalSnapshot: () => <div data-testid="clinical-snapshot" />,
}));
vi.mock('./ActionButtons', () => ({
  ActionButtons: () => <div data-testid="action-buttons" />,
}));
vi.mock('./ClientNameHeader', () => ({
  ClientNameHeader: () => <div data-testid="client-name-header" />,
}));
vi.mock('../WebBanner', () => ({
  WebBanner: ({ title }: { title: string }) => <div>{title}</div>,
}));

afterEach(() => {
  cleanup();
});

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

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    setRenamingAlias: vi.fn(),
    setYsqRequested: vi.fn(),
    deleteError: '',
    ...overrides,
  } as unknown as ClientDetail;
}

function baseProps(
  overrides: Partial<Parameters<typeof ClientDetailView>[0]> = {},
) {
  return {
    selectedClient: makeClient(),
    today: '2026-08-05',
    safeTop: 0,
    animKey: 0,
    switchView: vi.fn(),
    detail: makeDetail(),
    aliasInputRef: createRef<HTMLInputElement>(),
    startDateInputRef: createRef<HTMLInputElement>(),
    nextSessionInputRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
}

describe('ClientDetailView — состав экрана', () => {
  it('рендерит все дочерние блоки', () => {
    render(<ClientDetailView {...baseProps()} />);
    expect(screen.getByTestId('client-name-header')).toBeTruthy();
    expect(screen.getByTestId('session-card')).toBeTruthy();
    expect(screen.getByTestId('clinical-snapshot')).toBeTruthy();
    expect(screen.getByTestId('action-buttons')).toBeTruthy();
    expect(screen.getByText('Карта режимов клиента — на сайте')).toBeTruthy();
  });
});

describe('ClientDetailView — кнопка «Назад»', () => {
  it('клик по «‹» переключает вид на «list» И сбрасывает renamingAlias/ysqRequested', () => {
    const switchView = vi.fn();
    const setRenamingAlias = vi.fn();
    const setYsqRequested = vi.fn();
    render(
      <ClientDetailView
        {...baseProps({
          switchView,
          detail: makeDetail({ setRenamingAlias, setYsqRequested }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('‹'));
    expect(switchView).toHaveBeenCalledWith('list');
    expect(setRenamingAlias).toHaveBeenCalledWith(false);
    expect(setYsqRequested).toHaveBeenCalledWith(false);
  });
});

describe('ClientDetailView — ошибка удаления', () => {
  it('deleteError пуст — блок ошибки отсутствует в DOM', () => {
    const { container } = render(<ClientDetailView {...baseProps()} />);
    // Единственный текстовый узел с цветом accent-red — блок ошибки удаления;
    // при deleteError='' его не должно быть вовсе (а не пустая строка внутри).
    const errorNodes = Array.from(container.querySelectorAll('div')).filter(
      (el) => (el.getAttribute('style') ?? '').includes('accent-red'),
    );
    expect(errorNodes).toHaveLength(0);
  });

  it('deleteError задан — показывает текст ошибки', () => {
    render(
      <ClientDetailView
        {...baseProps({
          detail: makeDetail({ deleteError: 'Не удалось удалить клиента' }),
        })}
      />,
    );
    expect(screen.getByText('Не удалось удалить клиента')).toBeTruthy();
  });
});
