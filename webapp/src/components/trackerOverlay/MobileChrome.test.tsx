// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileFooter, MobileTopbar } from './MobileChrome';
import type { Need } from '../../types';

afterEach(() => cleanup());

const needs: Need[] = ['a', 'b', 'c'].map((id) => ({ id, emoji: '🙂', title: id, chartLabel: id }) as Need);

function footer(over: Partial<Parameters<typeof MobileFooter>[0]> = {}) {
  const p = { onPrev: vi.fn(), onNext: vi.fn(), onFinish: vi.fn(), onToEmpty: vi.fn() };
  render(<MobileFooter idx={1} needs={needs} allRated={false} lastSavedAt={null} {...p} {...over} />);
  return p;
}

describe('MobileFooter', () => {
  it('«Далее» и «Назад» зовут свои обработчики', () => {
    const p = footer();
    fireEvent.click(screen.getByText('Далее →'));
    fireEvent.click(screen.getByText(/Назад/));
    expect(p.onNext).toHaveBeenCalled();
    expect(p.onPrev).toHaveBeenCalled();
  });

  it('на первом шаге «Назад» недоступна', () => {
    footer({ idx: 0 });
    expect((screen.getByText(/Назад/).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('когда всё оценено — «Готово»; на последнем шаге с пропусками — «К незаполненным»', () => {
    const p = footer({ allRated: true });
    fireEvent.click(screen.getByText('✓ Готово'));
    expect(p.onFinish).toHaveBeenCalled();
    cleanup();
    const q = footer({ idx: 2 });
    fireEvent.click(screen.getByText('К незаполненным ↩'));
    expect(q.onToEmpty).toHaveBeenCalled();
  });

  it('подпись автосохранения: без времени — «автоматически», со временем — «сохранено ЧЧ:ММ»', () => {
    footer();
    expect(screen.getByText('сохранено автоматически')).toBeTruthy();
    cleanup();
    footer({ lastSavedAt: new Date(2026, 0, 1, 9, 5) });
    expect(screen.getByText(/сохранено \d{2}:\d{2}/)).toBeTruthy();
  });
});

describe('MobileTopbar', () => {
  it('показывает название, закрывает по крестику; заметка и история — только если переданы', () => {
    const goBack = vi.fn();
    render(<MobileTopbar isBackfill={false} goBack={goBack} />);
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
    expect(screen.queryByLabelText('Заметка')).toBeNull();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(goBack).toHaveBeenCalled();
  });

  it('бэкафилл: в названии дата; «История» открывает историю и закрывает трекер', () => {
    const goBack = vi.fn();
    const onOpenHistory = vi.fn();
    render(<MobileTopbar isBackfill date="2026-07-01" goBack={goBack} onOpenHistory={onOpenHistory} />);
    expect(screen.getByText('Оценки за 2026-07-01')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('История'));
    expect(onOpenHistory).toHaveBeenCalled();
    expect(goBack).toHaveBeenCalled();
  });
});
