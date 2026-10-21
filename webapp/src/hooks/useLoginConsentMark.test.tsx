// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLoginConsentMark } from './useLoginConsentMark';
import { wasLoginConsentShown } from '../auth/loginConsent';

beforeEach(() => localStorage.clear());

describe('useLoginConsentMark', () => {
  it('показ экрана входа отмечает, что текст согласия был виден', () => {
    expect(wasLoginConsentShown()).toBe(false);
    renderHook(() => useLoginConsentMark());
    expect(wasLoginConsentShown()).toBe(true);
  });
});
