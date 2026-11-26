// @vitest-environment jsdom
// Шаги установки — один блок на лендинг и /install (b28): текст из INSTALL_STEPS, вид — по месту.
import { existsSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { InstallBlock } from './InstallBlock';
import { INSTALL_STEPS, installGuide } from './installSteps';
import { BROWSER_STEPS } from './browserSteps';

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

  it('/install: шаги, подводка и ролик — браузера посетителя; звук выключен, включается кнопкой', () => {
    const { container } = render(<InstallBlock platforms={['android']} look="page" browser="android-yandex" />);
    expect(screen.getByText('В Яндекс Браузере:')).toBeTruthy();
    expect(container.querySelectorAll('.ib-steps li')).toHaveLength(BROWSER_STEPS['android-yandex'].steps.length);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('/install/install-android-yandex.mp4');
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(video.muted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Выключить звук' }));
    expect(video.muted).toBe(true);
  });

  it('«меньше движения»: ролик стоит и запускается своей кнопкой плеера', () => {
    const still = (on: boolean) => {
      window.matchMedia = ((q: string) => ({ matches: on && q.includes('reduce') })) as unknown as typeof window.matchMedia;
      const v = render(<InstallBlock platforms={['ios']} look="page" browser="ios-safari" />).container.querySelector('video') as HTMLVideoElement;
      cleanup();
      return { autoplay: v.autoplay, controls: v.controls };
    };
    expect(still(true)).toEqual({ autoplay: false, controls: true });
    expect(still(false)).toEqual({ autoplay: true, controls: false });
  });

  it('ролика нет: у компьютера и на лендинге', () => {
    expect(render(<InstallBlock platforms={['desktop']} look="page" />).container.querySelector('video')).toBeNull();
    expect(render(<InstallBlock platforms={['ios', 'android']} look="landing" />).container.querySelector('video')).toBeNull();
  });

  it('у каждого браузера есть файл ролика, а платформа без браузера берёт главный', () => {
    for (const b of Object.values(BROWSER_STEPS)) expect(existsSync(`public${b.video}`)).toBe(true);
    expect(installGuide('ios', 'ios-chrome')).toMatchObject({ title: INSTALL_STEPS.ios.title, browser: 'В Chrome:' });
    expect(installGuide('desktop', null)).toBe(INSTALL_STEPS.desktop);
  });
});
