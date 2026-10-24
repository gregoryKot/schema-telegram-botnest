// @vitest-environment jsdom
// B-12 аудита 2026-10: на экране 2FA сказано, где код спрашивается, а где нет —
// иначе «✓ Включена» читается как защита ото ВСЕХ входов.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TwoFactorSection } from './TwoFactorSection';
import { SCOPE_TEXT } from './TwoFactorScopeNote';
import { withAddressForm } from '../../components/settingsSheet/SettingsSheet.test-helpers';

afterEach(cleanup);

const NOTE = /Вход из мини-приложения Telegram или MAX идёт по подписи мессенджера — там второй фактор не спрашивается\./;

describe('TwoFactorSection — область действия 2FA', () => {
  it('текст содержит полный перечень входов, где код спрашивается, и оговорку про мини-приложения', () => {
    expect(SCOPE_TEXT).toContain('Google, VK, почту, виджет Telegram');
    expect(SCOPE_TEXT).toMatch(NOTE);
  });

  it.each(['ty', 'vy'] as const)('форма «%s», 2FA выключена: строка видна', (form) => {
    render(withAddressForm(
      <TwoFactorSection accessToken="t" totp={{ enabled: false, recoveryCodesLeft: 0 }} onChanged={() => {}} />, form));
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it.each(['ty', 'vy'] as const)('форма «%s», 2FA включена: строка рядом с «✓ Включена»', (form) => {
    render(withAddressForm(
      <TwoFactorSection accessToken="t" totp={{ enabled: true, recoveryCodesLeft: 3 }} onChanged={() => {}} />, form));
    expect(screen.getByText(/✓ Включена/)).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
  });
});
