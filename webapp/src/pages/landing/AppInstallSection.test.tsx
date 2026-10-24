// @vitest-environment jsdom
// Секция «значок на экране» лендинга: шаги всех трёх платформ из общего
// источника installSteps, CTA в /today, нативная кнопка установки при
// пойманном beforeinstallprompt; аналитика анонимная (public-event).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { installTelegram, removeTelegram } from '../../host/tgStub.test-helpers';

vi.mock('../../api', () => ({ api: { trackPublicEvent: vi.fn() } }));

import { api } from '../../api';
import { AppInstallSection } from './AppInstallSection';
import { INSTALL_STEPS } from '../../components/installGuide/installSteps';
import { _resetInstallPromptForTests } from '../../utils/pwaInstall';

beforeEach(() => {
  _resetInstallPromptForTests();
  vi.mocked(api.trackPublicEvent).mockClear();
});

afterEach(() => {
  removeTelegram();
  cleanup();
  vi.unstubAllGlobals();
});

describe('AppInstallSection', () => {
  it('рендерит карточки всех трёх платформ и CTA в /today', () => {
    render(<AppInstallSection />);
    for (const p of ['ios', 'android', 'desktop'] as const) {
      expect(screen.getByText(INSTALL_STEPS[p].title)).toBeTruthy();
      expect(screen.getByText(INSTALL_STEPS[p].steps[0])).toBeTruthy();
    }
    const cta = screen.getByText('Открыть приложение') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/today');
  });

  it('без пойманного beforeinstallprompt кнопки «Установить сейчас» нет', () => {
    render(<AppInstallSection />);
    expect(screen.queryByText('Установить сейчас')).toBeNull();
  });

  it('пойман beforeinstallprompt → «Установить сейчас» зовёт prompt и трекает анонимно', () => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(e);

    render(<AppInstallSection />);
    fireEvent.click(screen.getByText('Установить сейчас'));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(api.trackPublicEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'add',
      surface: 'site_landing',
    });
  });

  it('внутри установленного приложения (standalone) секции нет', () => {
    // Scope манифеста — «/», лендинг открывается и внутри приложения:
    // предлагать поставить то, что уже стоит, — незачем.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }));
    const { container } = render(<AppInstallSection />);
    expect(container.firstChild).toBeNull();
  });

  it('appinstalled → анонимный track added', () => {
    render(<AppInstallSection />);
    window.dispatchEvent(new Event('appinstalled'));
    expect(api.trackPublicEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'added',
      surface: 'site_landing',
    });
  });
});

describe('AppInstallSection внутри мессенджера', () => {
  it('скрыт внутри Telegram', () => {
    installTelegram();
    render(<AppInstallSection />);
    expect(screen.queryByText(INSTALL_STEPS.ios.title)).toBeNull();
  });
});
