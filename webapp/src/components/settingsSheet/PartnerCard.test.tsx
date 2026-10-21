// @vitest-environment jsdom
// PartnerCard (сайт) — карточка партнёра в паре. Регресс из ONE_FRONTEND_PLAN:
// «Выйти из пары» на сайте рвало связь без подтверждения, индекс был голой
// цифрой, а «Написать» и недельных столбиков не было вовсе.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PartnerCard } from './PartnerCard';
import type { PairsData } from '../../../../shared/src/apiTypes';

afterEach(cleanup);

type Partner = PairsData['partners'][number];
const make = (o: Partial<Partner> = {}): Partner => ({
  code: 'ABC', partnerIndex: null, partnerTodayDone: false, partnerName: 'Оля',
  partnerTelegramId: null, partnerWeekAvgs: [], ...o,
});

function setup(partner: Partner, extra: { confirm?: string | null; leaveError?: boolean } = {}) {
  const setConfirm = vi.fn();
  const onLeave = vi.fn();
  const view = render(
    <PartnerCard partner={partner} confirmLeaveCode={extra.confirm ?? null}
      setConfirmLeaveCode={setConfirm} onLeave={onLeave} leaveError={extra.leaveError} />,
  );
  return { setConfirm, onLeave, ...view };
}

describe('PartnerCard — день партнёра', () => {
  it('день пуст: безличный текст, без числа и без мужского рода', () => {
    setup(make());
    expect(screen.getByText('Дневник за сегодня пока пуст')).toBeTruthy();
    expect(screen.queryByText(/\/10/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/заполнил/);
  });

  it('день заполнен: индекс с тоном и фраза по порогу', () => {
    const { container } = setup(make({ partnerTodayDone: true, partnerIndex: 8.3 }));
    expect(screen.getByText('8.3')).toBeTruthy();
    expect(container.querySelector('.st-pc-tone--good')).not.toBeNull();
    expect(screen.getByText(/хороший день/)).toBeTruthy();
  });

  it('низкий индекс: красный тон и поддерживающая фраза', () => {
    const { container } = setup(make({ partnerTodayDone: true, partnerIndex: 2 }));
    expect(container.querySelector('.st-pc-tone--low')).not.toBeNull();
    expect(screen.getByText(/непростой день/)).toBeTruthy();
  });

  it('без имени — «Друг»', () => {
    setup(make({ partnerName: null }));
    expect(screen.getByText('Друг сегодня')).toBeTruthy();
  });
});

describe('PartnerCard — недельные столбики', () => {
  it('нет данных за неделю — столбиков нет', () => {
    const { container } = setup(make());
    expect(container.querySelector('.st-pc-bars')).toBeNull();
  });

  it('семь дней: семь столбиков, «сег» один и у последнего', () => {
    const avgs = [8, 5, 2, null, 6, 7, 9];
    const { container } = setup(make({ partnerWeekAvgs: avgs }));
    expect(container.querySelectorAll('.st-pc-bar')).toHaveLength(7);
    expect(screen.getAllByText('сег')).toHaveLength(1);
    const last = container.querySelectorAll('.st-pc-bar')[6];
    expect(last.textContent).toBe('сег');
  });
});

describe('PartnerCard — «Написать»', () => {
  it('без telegramId ссылки нет', () => {
    setup(make());
    expect(screen.queryByText('Написать')).toBeNull();
  });
  it('с telegramId — обычная ссылка tg://', () => {
    setup(make({ partnerTelegramId: 555 as Partner['partnerTelegramId'] }));
    expect(screen.getByText('Написать').closest('a')?.getAttribute('href')).toBe('tg://user?id=555');
  });
});

describe('PartnerCard — выход с подтверждением', () => {
  it('первый тап просит подтверждение и не рвёт пару', () => {
    const { setConfirm, onLeave } = setup(make());
    fireEvent.click(screen.getByText('Выйти из пары'));
    expect(setConfirm).toHaveBeenCalledWith('ABC');
    expect(onLeave).not.toHaveBeenCalled();
  });
  it('«Выйти» в подтверждении зовёт handleLeave с кодом', () => {
    const { onLeave } = setup(make(), { confirm: 'ABC' });
    fireEvent.click(screen.getByText('Выйти'));
    expect(onLeave).toHaveBeenCalledWith('ABC');
  });
  it('«Отмена» сбрасывает подтверждение и пару не трогает', () => {
    const { setConfirm, onLeave } = setup(make(), { confirm: 'ABC' });
    fireEvent.click(screen.getByText('Отмена'));
    expect(setConfirm).toHaveBeenCalledWith(null);
    expect(onLeave).not.toHaveBeenCalled();
  });
  it('подтверждение чужой карточки не раскрывает эту', () => {
    setup(make(), { confirm: 'OTHER' });
    expect(screen.getByText('Выйти из пары')).toBeTruthy();
  });
  it('leaveError виден текстом', () => {
    setup(make(), { leaveError: true });
    expect(screen.getByText(/Не удалось выйти из пары/)).toBeTruthy();
  });
});
