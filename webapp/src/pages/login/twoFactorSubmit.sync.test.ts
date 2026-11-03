// Сверка с бэкендом (правило №4 CLAUDE.md): CHALLENGE_EXPIRED дублирует
// src/auth/totp-challenge.ts::CHALLENGE_EXPIRED_REASON, потому что фронт не
// может импортировать бэкендовый модуль напрямую. Разъедутся строки — экран
// 2FA снова пишет «Неверный код» на протухший вызов (аудит 2026-10); тест
// падает при рассинхроне, а не молчит.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHALLENGE_EXPIRED } from './twoFactorSubmit';

describe('twoFactorSubmit — сверка с backend', () => {
  it('CHALLENGE_EXPIRED совпадает с CHALLENGE_EXPIRED_REASON в src/auth/totp-challenge.ts', () => {
    const src = readFileSync(resolve(__dirname, '../../../../src/auth/totp-challenge.ts'), 'utf8');
    const m = src.match(/CHALLENGE_EXPIRED_REASON\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(CHALLENGE_EXPIRED).toBe(m![1]);
  });
});
