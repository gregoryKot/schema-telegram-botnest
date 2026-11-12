// @vitest-environment jsdom
// «Партнёр» на сайте — паритет с PairPanel мини-аппа: при уже подключённом
// партнёре остаются «Позвать ещё одного человека» и ввод кода (партнёров может быть
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
    joinView: 'main', setJoinView: vi.fn(), joinCode: '', setJoinCode: vi.fn(), joinError: false, leaveError: null,
    confirmLeaveCode: null, setConfirmLeaveCode: vi.fn(), handleCreateInvite: vi.fn(), handleJoin: vi.fn(), handleLeave: vi.fn(),
    ...extra,
  } as PairMechanics;
}

describe('PartnerSection — несколько партнёров', () => {
  it('партнёр подключён: карточка и «Позвать ещё одного человека» + «Ввести код»', () => {
    const pair = pairOf({ partners: [PARTNER], pendingCode: null });
    render(<PartnerSection pair={pair} />);
    expect(screen.getByText('Аня сегодня')).toBeTruthy();
    fireEvent.click(screen.getByText('Позвать ещё одного человека'));
    expect(pair.handleCreateInvite).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Ввести код'));
    expect(pair.setJoinView).toHaveBeenCalledWith('join');
  });

  it('без партнёров кнопка называется «Позвать в пару»', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: null })} />);
    expect(screen.getByText('Позвать в пару')).toBeTruthy();
    expect(screen.queryByText('Позвать ещё одного человека')).toBeNull();
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
    expect(screen.getByText('Ждём партнёра')).toBeTruthy();
    expect(screen.getByText(URL)).toBeTruthy();
    expect(screen.getByText('Скопировать ссылку')).toBeTruthy();
    expect(screen.queryByText('Позвать в пару')).toBeNull();
    expect(screen.queryByText('Новая ссылка')).toBeNull();
    expect(screen.getByText('Ввести код')).toBeTruthy();
  });

  it('ждущее приглашение без ссылки от сервера: ссылки нет, но «Новая ссылка» и отмена остаются', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: 'WAIT1' })} />);
    expect(screen.getByText('Ждём партнёра')).toBeTruthy();
    expect(screen.queryByText('Скопировать ссылку')).toBeNull();
    expect(screen.getByText('Новая ссылка')).toBeTruthy();
    expect(screen.getByText('Отменить приглашение')).toBeTruthy();
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

  it('свежая ссылка, пока сервер не прислал свою, — с подписью «Скопируй и отправь»', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: 'WAIT1' }, { inviteUrl: URL })} />);
    expect(screen.getByText(URL)).toBeTruthy();
    expect(screen.getByText('Скопируй и отправь другу:')).toBeTruthy();
  });

  it('приглашение отменено или принято — мёртвую ссылку больше не предлагаем', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: null }, { inviteUrl: URL })} />);
    expect(screen.queryByText(URL)).toBeNull();
    expect(screen.queryByText('Скопируй и отправь другу:')).toBeNull();
  });

  it('«Отменить приглашение» уходит в выход по коду ждущей пары', () => {
    const pair = pairOf({ partners: [], pendingCode: 'WAIT1', pendingUrl: URL });
    render(<PartnerSection pair={pair} />);
    fireEvent.click(screen.getByText('Отменить приглашение'));
    expect(pair.handleLeave).toHaveBeenCalledWith('WAIT1');
  });

  it('сбой отмены виден у приглашения, а не у карточки партнёра', () => {
    render(<PartnerSection pair={pairOf({ partners: [PARTNER], pendingCode: 'WAIT1', pendingUrl: URL }, { leaveError: 'WAIT1' })} />);
    expect(screen.getByText('Не получилось отменить приглашение. Попробуй ещё раз')).toBeTruthy();
    expect(screen.queryByText('Не удалось выйти из пары. Попробуй ещё раз')).toBeNull();
  });
});

describe('PartnerSection — честный объём и согласие при вводе кода', () => {
  it('подпись раздела называет и неделю, а не «только число»', () => {
    render(<PartnerSection pair={pairOf({ partners: [], pendingCode: null })} />);
    expect(screen.getByText(/как он менялся за неделю/)).toBeTruthy();
    expect(screen.queryByText(/просто число/)).toBeNull();
  });

  it('ввод кода показывает, что увидит партнёр, и кнопка — «Присоединиться»', () => {
    const pair = pairOf({ partners: [], pendingCode: null }, { joinView: 'join', joinCode: 'AB12C' });
    render(<PartnerSection pair={pair} />);
    expect(screen.getByTestId('pair-join-consent').textContent).toMatch(/индекс дня .* последнюю неделю/);
    fireEvent.click(screen.getByText('Присоединиться'));
    expect(pair.handleJoin).toHaveBeenCalledTimes(1);
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
