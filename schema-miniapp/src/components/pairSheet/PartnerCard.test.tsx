// @vitest-environment jsdom
// PartnerCard — карточка партнёра по совместному отслеживанию. Проверяет:
// «ещё не заполнил» вместо выдуманного индекса (правило «никаких
// хардкод-заглушек» — 0 не подставляется, когда данных нет), контекстное
// сообщение по диапазону индекса, и двухшаговое подтверждение выхода из
// пары (важно: случайный тап не должен разрывать пару без подтверждения).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PartnerCard } from './PartnerCard';
import type { PairsData } from '../../api';

afterEach(() => {
  cleanup();
});

type Partner = PairsData['partners'][number];

function makePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    code: 'ABC123',
    partnerIndex: null,
    partnerTodayDone: false,
    partnerName: 'Оля',
    partnerTelegramId: null,
    partnerWeekAvgs: [],
    ...overrides,
  };
}

describe('PartnerCard — состояние «сегодня»', () => {
  it('партнёр ещё не заполнил дневник — текст, а не число 0', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerTodayDone: false })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.getByText('Ещё не заполнил')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('партнёр заполнил — показывает реальный индекс', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerTodayDone: true, partnerIndex: 8.3 })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.getByText('8.3')).toBeTruthy();
  });

  it('без имени партнёра — фолбэк "Друг"', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerName: null })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.getByText('Друг сегодня')).toBeTruthy();
  });

  it('низкий индекс (<4) — поддерживающее сообщение о непростом дне', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerTodayDone: true, partnerIndex: 2 })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.getByText(/непростой день/)).toBeTruthy();
  });
});

describe('PartnerCard — кнопка «Написать»', () => {
  it('без telegramId кнопки «Написать» нет', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerTelegramId: null })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.queryByText('Написать')).toBeNull();
  });

  it('с telegramId кнопка «Написать» отображается', () => {
    render(
      <PartnerCard
        partner={makePartner({ partnerTelegramId: 555 })}
        confirmLeaveCode={null}
        setConfirmLeaveCode={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(screen.getByText('Написать')).toBeTruthy();
  });
});

describe('PartnerCard — выход из пары (двухшаговое подтверждение)', () => {
  it('первый клик по «Выйти из пары» просит подтверждение, а не рвёт пару', () => {
    const setConfirmLeaveCode = vi.fn();
    const onLeave = vi.fn();
    const partner = makePartner();
    render(
      <PartnerCard
        partner={partner}
        confirmLeaveCode={null}
        setConfirmLeaveCode={setConfirmLeaveCode}
        onLeave={onLeave}
      />,
    );
    fireEvent.click(screen.getByText('Выйти из пары'));
    expect(setConfirmLeaveCode).toHaveBeenCalledWith(partner.code);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('в режиме подтверждения клик «Выйти» реально зовёт onLeave', () => {
    const onLeave = vi.fn();
    const partner = makePartner();
    render(
      <PartnerCard
        partner={partner}
        confirmLeaveCode={partner.code}
        setConfirmLeaveCode={() => {}}
        onLeave={onLeave}
      />,
    );
    fireEvent.click(screen.getByText('Выйти'));
    expect(onLeave).toHaveBeenCalledWith(partner.code);
  });

  it('«Отмена» в режиме подтверждения сбрасывает confirmLeaveCode', () => {
    const setConfirmLeaveCode = vi.fn();
    const partner = makePartner();
    render(
      <PartnerCard
        partner={partner}
        confirmLeaveCode={partner.code}
        setConfirmLeaveCode={setConfirmLeaveCode}
        onLeave={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Отмена'));
    expect(setConfirmLeaveCode).toHaveBeenCalledWith(null);
  });
});
