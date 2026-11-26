// @vitest-environment jsdom
// Пока вход поднимается — силуэт того экрана, куда человек откроется (не крутилка); «Сервер не
// отвечает» — лист исхода «на нашей стороне», и повтор видно занятым, пока refresh идёт (аудит 2026-11:
// RequireAuth не передавал retrying — повторное нажатие ничем не отмечалось; сам хук — useRetrying.test.ts).
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionTrouble } from '../../../shared/src/components/ConnectionTrouble';
import { ConnectionOutcome, GateSkeleton } from './AuthGateViews';

describe('GateSkeleton', () => {
  it('кабинет: оболочка с меню и силуэтом раздела, без крутилки', () => {
    const { container } = render(<GateSkeleton pathname="/today" />);
    expect(container.querySelector('[data-testid="app-shell-skeleton"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="today-skeleton"]')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeNull();
  });

  it('кабинет терапевта: силуэт «Сегодня» терапевта', () => {
    const { container } = render(<GateSkeleton pathname="/cabinet/today" />);
    expect(container.querySelector('[data-testid="therapist-today-skeleton"]')).toBeTruthy();
  });

  it('страница аккаунта: колонка без меню кабинета', () => {
    const { container } = render(<GateSkeleton pathname="/account/merge" />);
    expect(container.querySelector('[data-testid="app-shell-skeleton"]')).toBeNull();
    expect(container.querySelector('.gate-page .sks-screen')).toBeTruthy();
  });
});

describe('ConnectionOutcome', () => {
  it('исход «на нашей стороне»: заголовок h1, лид, «Повторить»; занятая кнопка — «Проверяем…» и не жмётся', () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(<ConnectionTrouble onRetry={onRetry} Frame={ConnectionOutcome} />);
    expect(container.querySelector('.pa-outcome-card')?.getAttribute('data-sign')).toBe('breath');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Сервер не\u00a0отвечает'); // «не» держится со словом (glueSpaces в PaperOutcome, r1)
    fireEvent.click(screen.getByText('Повторить'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<ConnectionTrouble onRetry={onRetry} retrying Frame={ConnectionOutcome} />);
    const busy = screen.getByText('Проверяем…') as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
  });
});
