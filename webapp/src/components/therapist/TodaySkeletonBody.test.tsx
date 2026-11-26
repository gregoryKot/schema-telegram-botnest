// @vitest-environment jsdom
// Силуэт «Сегодня» терапевта — той же бумаги, что экран: литерал силуэта (он в главном чанке и
// cabinetLook не импортирует) сверены с cabinetLook (правило №4); подпись «Загружаются клиенты» — только у экрана.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SESSIONS_LOOK } from './cabinetLook';
import { TodaySkeletonBody } from './TodaySkeletonBody';

const hueOf = (el: Element | null) => (el as HTMLElement).style.getPropertyValue('--h');

describe('TodaySkeletonBody', () => {
  it('счётчики без цветной плитки, бумага листа сессий — как у экрана', () => {
    const { container } = render(<TodaySkeletonBody />);
    const counters = [...container.querySelectorAll('.sks-counter')];
    expect(counters).toHaveLength(3);
    expect(counters.some((c) => c.classList.contains('pp-paper'))).toBe(false);
    expect(hueOf(container.querySelector('.sks-sessions'))).toBe(String(SESSIONS_LOOK.hue));
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('с подписью — role="status" для экрана', () => {
    render(<TodaySkeletonBody label="Загружаются клиенты" />);
    expect(screen.getByRole('status', { name: 'Загружаются клиенты' })).toBeTruthy();
  });
});
