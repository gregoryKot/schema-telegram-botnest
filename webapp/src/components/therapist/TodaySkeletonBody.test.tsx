// @vitest-environment jsdom
// Силуэт «Сегодня» терапевта (b29) — той же бумаги, что экран: литералы силуэта (он в главном чанке и
// cabinetLook не импортирует) сверены с cabinetLook (правило №4); подпись «Загружаются клиенты» — только у экрана.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SESSIONS_LOOK, TODAY_COUNTER_LOOK } from './cabinetLook';
import { TodaySkeletonBody } from './TodaySkeletonBody';

const hueOf = (el: Element | null) => (el as HTMLElement).style.getPropertyValue('--h');

describe('TodaySkeletonBody', () => {
  it('бумага плиток и листа сессий — как у экрана', () => {
    const { active, sessions, attention } = TODAY_COUNTER_LOOK;
    const { container } = render(<TodaySkeletonBody />);
    expect([...container.querySelectorAll('.sks-counter')].map(hueOf)).toEqual([active.hue, sessions.hue, attention.hue].map(String));
    expect(hueOf(container.querySelector('.sks-sessions'))).toBe(String(SESSIONS_LOOK.hue));
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('с подписью — role="status" для экрана', () => {
    render(<TodaySkeletonBody label="Загружаются клиенты" />);
    expect(screen.getByRole('status', { name: 'Загружаются клиенты' })).toBeTruthy();
  });
});
