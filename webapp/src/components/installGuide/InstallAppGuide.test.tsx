// @vitest-environment jsdom
// Инструкция «значок на экран»: шаги под платформу из единого источника
// installSteps; где браузер умеет ставить PWA сам — настоящая кнопка
// установки (beforeinstallprompt) с событием аналитики через колбэк.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InstallAppGuide } from './InstallAppGuide';
import { INSTALL_STEPS } from './installSteps';
import { _resetInstallPromptForTests } from '../../utils/pwaInstall';

function fireBeforeInstallPrompt() {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  window.dispatchEvent(e);
  return prompt;
}

beforeEach(() => {
  cleanup();
  _resetInstallPromptForTests();
});

describe('InstallAppGuide', () => {
  it('iOS: шаги Safari, без кнопки установки (Safari события не даёт)', () => {
    render(<InstallAppGuide track={vi.fn()} platform="ios" />);
    expect(screen.getByText('В Safari:')).toBeTruthy();
    for (const step of INSTALL_STEPS.ios.steps) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    expect(screen.queryByText('Установить приложение')).toBeNull();
  });

  it('Android: свои шаги из общего источника', () => {
    render(<InstallAppGuide track={vi.fn()} platform="android" />);
    expect(screen.getByText('В Chrome:')).toBeTruthy();
    expect(screen.getByText(INSTALL_STEPS.android.steps[0])).toBeTruthy();
  });

  it('пойман beforeinstallprompt → кнопка установки, клик зовёт prompt и трекает add', () => {
    const prompt = fireBeforeInstallPrompt();
    const track = vi.fn();
    render(<InstallAppGuide track={track} platform="android" />);
    fireEvent.click(screen.getByText('Установить приложение'));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('add');
  });

  it('appinstalled → track(added)', () => {
    const track = vi.fn();
    render(<InstallAppGuide track={track} platform="desktop" />);
    window.dispatchEvent(new Event('appinstalled'));
    expect(track).toHaveBeenCalledWith('added');
  });
});
