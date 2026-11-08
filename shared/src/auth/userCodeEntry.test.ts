// Ввод кода билета руками на экране сверки входа (S9, аудит 2026-11).
import { describe, it, expect } from 'vitest';
import {
  displayUserCodeInput,
  normalizeUserCode,
  userCodesMatch,
} from './userCodeEntry';

describe('normalizeUserCode', () => {
  it('регистр, дефис и пробелы не важны; длина — не больше кода', () => {
    expect(normalizeUserCode('k7m2-qx94')).toBe('K7M2QX94');
    expect(normalizeUserCode(' K7M2 QX94 77')).toBe('K7M2QX94');
  });

  it('кириллические двойники с русской раскладки читаются как латиница', () => {
    expect(normalizeUserCode('к7м2-рх94')).toBe('K7M2PX94');
  });

  it('прочие символы отбрасываются', () => {
    expect(normalizeUserCode('<K7>"M2"')).toBe('K7M2');
  });
});

describe('displayUserCodeInput', () => {
  it('дефис появляется после четвёртого знака', () => {
    expect(displayUserCodeInput('K7M')).toBe('K7M');
    expect(displayUserCodeInput('K7M2')).toBe('K7M2');
    expect(displayUserCodeInput('K7M2Q')).toBe('K7M2-Q');
  });
});

describe('userCodesMatch', () => {
  it('совпадает только введённый целиком тот же код', () => {
    expect(userCodesMatch('k7m2-qx94', 'K7M2QX94')).toBe(true);
    expect(userCodesMatch('K7M2QX9', 'K7M2QX94')).toBe(false);
    expect(userCodesMatch('K7M2QX95', 'K7M2QX94')).toBe(false);
    expect(userCodesMatch('', '')).toBe(false);
  });
});
