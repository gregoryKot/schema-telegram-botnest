// @vitest-environment jsdom
// Шаги установки — один блок на лендинг и /install (b28): текст из INSTALL_STEPS, вид — по месту.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InstallBlock } from './InstallBlock';
import { INSTALL_STEPS } from './installSteps';

afterEach(cleanup);

describe('InstallBlock', () => {
  it('лендинг: три платформы карточками pl2-* по порядку, шаги каждой', () => {
    const { container } = render(<InstallBlock platforms={['ios', 'android', 'desktop']} look="landing" />);
    const cards = [...container.querySelectorAll('.pl2-install')];
    expect(cards.map((c) => c.querySelector('.pl2-card-title')?.textContent)).toEqual(['ios', 'android', 'desktop'].map((p) => INSTALL_STEPS[p as 'ios'].title));
    expect(cards.map((c) => c.querySelectorAll('.pl2-card-list li').length)).toEqual(['ios', 'android', 'desktop'].map((p) => INSTALL_STEPS[p as 'ios'].steps.length));
    expect(container.querySelector('.ib-card')).toBeNull();
  });

  it('/install: шаги своей платформы на листе неба 240, без классов лендинга', () => {
    const { container } = render(<InstallBlock platforms={['android']} look="page" />);
    const card = container.querySelector('.ib-card') as HTMLElement;
    expect(card.className).toBe('pp-paper ib-card');
    expect(card.style.getPropertyValue('--h')).toBe('240');
    expect(card.querySelectorAll('.ib-steps li')).toHaveLength(INSTALL_STEPS.android.steps.length);
    expect(screen.getByText(INSTALL_STEPS.android.browser)).toBeTruthy();
    expect(container.querySelector('.pl2-card')).toBeNull();
  });
});
