// @vitest-environment jsdom
// PartnerSection — «партнёр» в настройках (0% покрытия). Четыре состояния
// одного блока: загрузка (скелетон, не спиннер — правило CLAUDE.md), уже в
// паре (индекс друга или «ещё не заполнил»), пусто (создать/скопировать
// приглашение), ввод чужого кода. Дублирующих переключателей вида нет —
// весь стейт снаружи, проверяем каждую ветку рендера отдельно.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PartnerSection } from './PartnerSection';
import type { PairsData } from '../../api';

afterEach(() => {
  cleanup();
});

function baseProps(
  overrides: Partial<Parameters<typeof PartnerSection>[0]> = {},
) {
  return {
    pairLoading: false,
    pairData: null as PairsData | null,
    handleLeave: vi.fn(),
    handleCreateInvite: vi.fn(),
    pairInviteUrl: '',
    pairInviteCopied: false,
    pairInviteLabel: 'Скопировать ссылку',
    handleCopyPairInvite: vi.fn(),
    joinView: 'main' as const,
    setJoinView: vi.fn(),
    joinCode: '',
    setJoinCode: vi.fn(),
    joinError: false,
    handleJoin: vi.fn(),
    onInfo: vi.fn(),
    ...overrides,
  };
}

describe('PartnerSection — загрузка', () => {
  it('pairLoading=true и данных ещё нет — скелетон, не спиннер/текст «Загрузка»', () => {
    render(<PartnerSection {...baseProps({ pairLoading: true })} />);
    expect(screen.queryByText(/Загрузка/)).toBeNull();
    expect(screen.queryByText('Создать приглашение')).toBeNull();
  });
});

describe('PartnerSection — уже в паре', () => {
  const partner = {
    code: 'ABC123',
    partnerIndex: 7.4,
    partnerTodayDone: true,
    partnerName: 'Оля',
    partnerTelegramId: 1,
    partnerWeekAvgs: [],
  };

  it('партнёр заполнил дневник — показывает индекс дня', () => {
    render(
      <PartnerSection
        {...baseProps({ pairData: { partners: [partner], pendingCode: null } })}
      />,
    );
    expect(screen.getByText('Оля сегодня')).toBeTruthy();
    expect(screen.getByText('7.4')).toBeTruthy();
  });

  it('партнёр без имени — подпись «Друг сегодня»', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: {
            partners: [{ ...partner, partnerName: null }],
            pendingCode: null,
          },
        })}
      />,
    );
    expect(screen.getByText('Друг сегодня')).toBeTruthy();
  });

  it('партнёр ещё не заполнил дневник — сообщение вместо индекса', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: {
            partners: [
              { ...partner, partnerTodayDone: false, partnerIndex: null },
            ],
            pendingCode: null,
          },
        })}
      />,
    );
    expect(screen.getByText('Ещё не заполнил дневник')).toBeTruthy();
    expect(screen.queryByText('7.4')).toBeNull();
  });

  it('клик «Выйти из пары» зовёт handleLeave с кодом пары', () => {
    const handleLeave = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [partner], pendingCode: null },
          handleLeave,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Выйти из пары'));
    expect(handleLeave).toHaveBeenCalledWith('ABC123');
  });
});

describe('PartnerSection — пусто, экран приглашения', () => {
  it('нет пары — кнопка «Создать приглашение»', () => {
    render(
      <PartnerSection
        {...baseProps({ pairData: { partners: [], pendingCode: null } })}
      />,
    );
    expect(screen.getByText('Создать приглашение')).toBeTruthy();
  });

  it('pendingCode уже есть — кнопка «Создать новую ссылку»', () => {
    render(
      <PartnerSection
        {...baseProps({ pairData: { partners: [], pendingCode: 'XYZ' } })}
      />,
    );
    expect(screen.getByText('Создать новую ссылку')).toBeTruthy();
  });

  it('клик по кнопке создания зовёт handleCreateInvite', () => {
    const handleCreateInvite = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          handleCreateInvite,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Создать приглашение'));
    expect(handleCreateInvite).toHaveBeenCalled();
  });

  it('pairInviteUrl задан — показывает ссылку и кнопку копирования', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: 'XYZ' },
          pairInviteUrl: 'https://t.me/bot?start=xyz',
        })}
      />,
    );
    expect(screen.getByText('https://t.me/bot?start=xyz')).toBeTruthy();
    expect(screen.getByText('Скопировать ссылку')).toBeTruthy();
  });

  it('pairInviteCopied=true — подпись меняется на «✓ Скопировано»', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: 'XYZ' },
          pairInviteUrl: 'https://t.me/bot?start=xyz',
          pairInviteCopied: true,
          pairInviteLabel: '✓ Скопировано',
        })}
      />,
    );
    expect(screen.getByText('✓ Скопировано')).toBeTruthy();
  });

  it('отказ буфера виден в подписи кнопки (был: молча проглочен)', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: 'XYZ' },
          pairInviteUrl: 'https://t.me/bot?start=xyz',
          pairInviteLabel: 'Не скопировалось',
        })}
      />,
    );
    expect(screen.getByText(/Не скопировалось/)).toBeTruthy();
  });

  it('клик по ссылке-кнопке копирования зовёт handleCopyPairInvite', () => {
    const handleCopyPairInvite = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: 'XYZ' },
          pairInviteUrl: 'https://t.me/bot?start=xyz',
          handleCopyPairInvite,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Скопировать ссылку'));
    expect(handleCopyPairInvite).toHaveBeenCalled();
  });

  it('клик «Есть код приглашения» переключает на joinView=join', () => {
    const setJoinView = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          setJoinView,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Есть код приглашения'));
    expect(setJoinView).toHaveBeenCalledWith('join');
  });
});

describe('PartnerSection — ввод кода приглашения', () => {
  it('ввод в поле кода приводится к верхнему регистру через setJoinCode', () => {
    const setJoinCode = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          joinView: 'join',
          setJoinCode,
        })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Код из приглашения'), {
      target: { value: 'abc123' },
    });
    expect(setJoinCode).toHaveBeenCalledWith('ABC123');
  });

  it('joinError=true — показывает «Код не найден или уже использован»', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          joinView: 'join',
          joinError: true,
        })}
      />,
    );
    expect(screen.getByText('Код не найден или уже использован')).toBeTruthy();
  });

  it('пустой код — кнопка «Присоединиться» disabled', () => {
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          joinView: 'join',
          joinCode: '',
        })}
      />,
    );
    const btn = screen.getByText('Присоединиться');
    expect(btn.disabled).toBe(true);
  });

  it('код введён — кнопка активна, клик зовёт handleJoin', () => {
    const handleJoin = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          joinView: 'join',
          joinCode: 'ABC123',
          handleJoin,
        })}
      />,
    );
    const btn = screen.getByText('Присоединиться');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(handleJoin).toHaveBeenCalled();
  });

  it('клик «‹ Назад» возвращает joinView в main', () => {
    const setJoinView = vi.fn();
    render(
      <PartnerSection
        {...baseProps({
          pairData: { partners: [], pendingCode: null },
          joinView: 'join',
          setJoinView,
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Назад'));
    expect(setJoinView).toHaveBeenCalledWith('main');
  });
});

describe('PartnerSection — пояснение', () => {
  it('клик по кнопке «?» зовёт onInfo', () => {
    const onInfo = vi.fn();
    render(<PartnerSection {...baseProps({ onInfo })} />);
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(onInfo).toHaveBeenCalled();
  });
});
