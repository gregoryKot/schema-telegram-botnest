// @vitest-environment jsdom
// Значок достижения (b21): вид — ACHIEVEMENT_LOOK; не получено — силуэт; незнакомое — ничего.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ACHIEVEMENT_LOOK } from '../../../../shared/src/theme/entityLook';
import { AchievementBadge } from './AchievementBadge';
import { PortraitNeedBar } from './PortraitNeedBar';
import { buildPortrait } from '../../../../shared/src/portrait/portraitData';
import { needDataColor } from '../../components/needDataColor';

afterEach(cleanup);

describe('AchievementBadge', () => {
  it.each(Object.entries(ACHIEVEMENT_LOOK))('%s: бумага своего оттенка и свой знак', (id, look) => {
    const { container } = render(<AchievementBadge id={id} earned />);
    const badge = container.querySelector('.cpf-badge')!;
    expect(badge.classList.contains('is-earned')).toBe(true);
    expect(badge.getAttribute('style')).toContain(`--h: ${look.hue}`);
    expect(badge.getAttribute('data-sign')).toBe(look.sign);
    expect(badge.querySelector('svg.pp-art')).not.toBeNull();
  });

  it('не получено — силуэт того же знака, а не пустой квадрат', () => {
    const { container } = render(<AchievementBadge id="streak_7" earned={false} />);
    const badge = container.querySelector('.cpf-badge')!;
    expect(badge.classList.contains('is-locked')).toBe(true);
    expect(badge.querySelector('svg.pp-art')).not.toBeNull();
  });

  it('незнакомое достижение — без выдуманного знака', () => {
    const { container } = render(<AchievementBadge id="hasOwnProperty" earned />);
    expect(container.innerHTML).toBe('');
  });
});

describe('PortraitNeedBar', () => {
  it('полоса — цвет данных потребности, знак потребности вместо эмодзи', () => {
    for (const n of buildPortrait({ manualSchemaIds: ['abandonment'] }).needs) {
      const { container, unmount } = render(<PortraitNeedBar n={n} maxCount={1} />);
      const bar = container.querySelector<HTMLElement>('.cpf-bar')!;
      expect(bar.style.getPropertyValue('--nd')).toBe(needDataColor(n.id));
      expect(bar.querySelector('.cpf-bar-sign svg.pp-art')).not.toBeNull();
      expect(bar.textContent).not.toContain(n.emoji);
      unmount();
    }
  });
});
