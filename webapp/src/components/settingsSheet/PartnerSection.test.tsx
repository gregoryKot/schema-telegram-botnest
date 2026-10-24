// @vitest-environment jsdom
// «Партнёр» на сайте — паритет с PairPanel мини-аппа: при уже подключённом
// партнёре остаются «Пригласить ещё друга» и ввод кода (партнёров может быть
// несколько), а ждущее приглашение показывается ссылкой для повторной отправки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { PairMechanics } from '../../../../shared/src/pair/usePairMechanics';
import type { PairsData } from '../../../../shared/src/apiTypes';
import { PartnerSection } from './PartnerSection';

afterEach(cleanup);

const PARTNER = { code: 'P1', partnerIndex: 7, partnerTodayDone: true, partnerName: 'Аня', partnerTelegramId: null, partnerWeekAvgs: [] } as PairsData['partners'][number];
const URL = 'https://t.me/bot/diary?startapp=pair_WAIT1';

function pairOf(data: PairsData | null, extra: Partial<PairMechanics> = {}): PairMechanics {
  return {
    data, loadError: false, retryLoad: vi.fn(), loading: false, inviteUrl: '', inviteCode: '', createError: false,
    joinView: 'main', setJoinView: vi.fn(), joinCode: '', setJoinCode: vi.fn(), joinError: false, leaveError: false,
    confirmLeaveCode: null, setConfirmLeaveCode: vi.fn(), handleCreateInvite: vi.fn(), handleJoin: vi.fn(), handleLeave: vi.fn(),
    ...extra,
  } as PairMechanics;
}

describe('PartnerSection — несколько партнёров', () => {
  it('партнёр подключён: карточка и «Пригласить ещё друга» + «Ввести код»', () => {
    const pair = pairOf({ partners: [PARTNER], pendingCode: null });
    render(<PartnerSection pair={pair} />);
    expect(screen.getByText('Аня сегодня')).toBeTruthy();
    fireEvent.click(screen.getByText('Пригласить ещё друга'));
    expect(pair.handleCreateInvite).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Ввести код'));
    expect(pair.setJoinView).toHaveBeenCalledWith('join');
  });

  it('без партнёров кнопка называется «Пригласить друга»', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: null })} />);
    expect(screen.getByText('Пригласить друга')).toBeTruthy();
    expect(screen.queryByText('Пригласить ещё друга')).toBeNull();
  });

  it('открыт ввод кода при подключённом партнёре — форма, карточки скрыты', () => {
    render(<PartnerSection pair={pairOf({ partners: [PARTNER], pendingCode: null }, { joinView: 'join' })} />);
    expect(screen.getByPlaceholderText('Код')).toBeTruthy();
    expect(screen.queryByText('Аня сегодня')).toBeNull();
  });
});

describe('PartnerSection — ждём партнёра', () => {
  it('ждущее приглашение: ссылка для повторной отправки, кнопки создания нет', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: 'WAIT1', pendingUrl: URL })} />);
    expect(screen.getByText('⏳ Ждём партнёра')).toBeTruthy();
    expect(screen.getByText(URL)).toBeTruthy();
    expect(screen.getByText('Скопировать ссылку')).toBeTruthy();
    expect(screen.queryByText('Пригласить друга')).toBeNull();
    expect(screen.queryByText('Новая ссылка')).toBeNull();
    expect(screen.getByText('Ввести код')).toBeTruthy();
  });

  it('ждущее приглашение без ссылки от сервера: ссылки нет, но «Новая ссылка» остаётся', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: 'WAIT1' })} />);
    expect(screen.queryByText('⏳ Ждём партнёра')).toBeNull();
    expect(screen.getByText('Новая ссылка')).toBeTruthy();
  });

  it('подключённый партнёр и ждущее приглашение одновременно', () => {
    render(<PartnerSection pair={pairOf({ partners: [PARTNER], pendingCode: 'WAIT1', pendingUrl: URL })} />);
    expect(screen.getByText('Аня сегодня')).toBeTruthy();
    expect(screen.getByText(URL)).toBeTruthy();
  });

  it('свежесозданная ссылка, совпавшая с ждущей, не показывается дважды', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: 'WAIT1', pendingUrl: URL }, { inviteUrl: URL })} />);
    expect(screen.getAllByText(URL)).toHaveLength(1);
  });

  it('свежесозданная ссылка без ждущего приглашения показывается с подписью «Скопируй и отправь»', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: null }, { inviteUrl: URL })} />);
    expect(screen.getByText(URL)).toBeTruthy();
    expect(screen.getByText('Скопируй и отправь другу:')).toBeTruthy();
  });
});

describe('PartnerSection — загрузка и сбой', () => {
  it('сбой загрузки не выглядит как «нет партнёра»', () => {
    const pair = pairOf(null, { loadError: true });
    render(<PartnerSection pair={pair} />);
    expect(screen.getByText('Не удалось загрузить данные о партнёре')).toBeTruthy();
    expect(screen.queryByText('Ввести код')).toBeNull();
    fireEvent.click(screen.getByText('Повторить'));
    expect(pair.retryLoad).toHaveBeenCalled();
  });
  it('пока грузится — «Загрузка...»', () => {
    render(<PartnerSection pair={pairOf(null)} />);
    expect(screen.getByText('Загрузка...')).toBeTruthy();
  });
});
