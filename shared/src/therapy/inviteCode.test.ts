// Ввод кода приглашения (инцидент 2026-10-26): поле пускало 8 знаков при коде
// из 12, вставленный код обрезался, подключиться не мог никто. Длину сверяет с
// сервером src/therapy/therapy-invite-code.parity.spec.ts; здесь — что всё,
// что человек реально вставляет, превращается в код целиком.
import { describe, it, expect } from 'vitest';
import {
  normalizeTherapyCode,
  THERAPY_INVITE_CODE_LENGTH,
  THERAPY_INVITE_CODE_PLACEHOLDER,
  THERAPY_INVITE_INPUT_MAX,
} from './inviteCode';

const CODE = '7F3A9C21B04E';

describe('normalizeTherapyCode', () => {
  it('код из 12 знаков проходит целиком (регресс: поле резало до 8)', () => {
    expect(normalizeTherapyCode(CODE)).toBe(CODE);
    expect(normalizeTherapyCode(CODE)).toHaveLength(THERAPY_INVITE_CODE_LENGTH);
  });

  it('строчные → заглавные, пробелы и перенос по краям и внутри убираются', () => {
    expect(normalizeTherapyCode(' 7f3a 9c21\nb04e ')).toBe(CODE);
  });

  it('вставлена ссылка целиком — берётся код из startapp', () => {
    expect(
      normalizeTherapyCode(
        `https://t.me/SchemeHappensBot/diary?startapp=therapy_${CODE.toLowerCase()}`,
      ),
    ).toBe(CODE);
  });

  it('лишнее за длиной кода отбрасывается, пустое остаётся пустым', () => {
    expect(normalizeTherapyCode(`${CODE}FFFF`)).toBe(CODE);
    expect(normalizeTherapyCode('   ')).toBe('');
  });
});

describe('поле ввода кода', () => {
  it('пример той же длины, что настоящий код', () => {
    expect(THERAPY_INVITE_CODE_PLACEHOLDER).toHaveLength(
      THERAPY_INVITE_CODE_LENGTH,
    );
    expect(normalizeTherapyCode(THERAPY_INVITE_CODE_PLACEHOLDER)).toBe(
      THERAPY_INVITE_CODE_PLACEHOLDER,
    );
  });

  it('родной предел поля пропускает ссылку целиком — иначе вставка обрезалась бы до разбора', () => {
    const link = `https://t.me/SchemeHappensBot/diary?startapp=therapy_${CODE}`;
    expect(link.length).toBeLessThanOrEqual(THERAPY_INVITE_INPUT_MAX);
  });
});
