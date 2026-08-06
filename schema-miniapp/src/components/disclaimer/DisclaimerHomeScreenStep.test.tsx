// @vitest-environment jsdom
// DisclaimerHomeScreenStep — финальный шаг онбординга «добавь на экран»
// (0% покрытия). Подсказка платформы (buildHomeScreenHint) различается для
// iOS/Android — паттерн setHost/globalThis.Telegram тот же, что уже
// используется в HomeScreenSection.test.tsx (та же логика хоста).
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { setHost } from '../../../../shared/src/host';
import { AddressFormContext } from '../../utils/addressForm';
import { DisclaimerHomeScreenStep } from './DisclaimerHomeScreenStep';

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
});

afterEach(() => {
  cleanup();
});

describe('DisclaimerHomeScreenStep', () => {
  it('на Android в Telegram: подсказка про подтверждение в Telegram, форма «ты»', () => {
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: {
        platform: 'android',
        initData: 'hash=abc',
        addToHomeScreen: () => {},
      },
    };
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: () => {} }}>
        <DisclaimerHomeScreenStep onBeforeAdd={() => {}} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Добавь на главный экран')).toBeTruthy();
    expect(screen.getByText(/Telegram спросит подтверждение/)).toBeTruthy();
  });

  it('на iOS в Telegram: своя подсказка про инструкцию, форма «вы»', () => {
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: {
        platform: 'ios',
        initData: 'hash=abc',
        addToHomeScreen: () => {},
      },
    };
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <DisclaimerHomeScreenStep onBeforeAdd={() => {}} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Добавьте на главный экран')).toBeTruthy();
    expect(screen.getByText(/следуйте инструкции/)).toBeTruthy();
  });
});
