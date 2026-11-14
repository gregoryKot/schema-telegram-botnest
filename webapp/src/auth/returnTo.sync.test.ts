// Сверка с бэкендом (правило №4): правило адреса возврата для ссылки из
// письма живёт в двух местах — сайт не импортирует бэкендовый модуль. Сайт,
// пропустивший путь, который DTO отвергнет, ронял бы вход по почте 400-м.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMAIL_RETURN_PARAM, EMAIL_RETURN_TO_MAX, EMAIL_RETURN_TO_RE } from './emailReturnTo';

const src = readFileSync(resolve(__dirname, '../../../src/auth/email-link-params.ts'), 'utf8');
const pick = (re: RegExp) => {
  const m = src.match(re);
  expect(m).not.toBeNull();
  return m![1];
};

describe('emailReturnTo — сверка с src/auth/email-link-params.ts', () => {
  it('имя параметра, предел длины и правило пути совпадают', () => {
    expect(EMAIL_RETURN_PARAM).toBe(pick(/RETURN_TO_PARAM = '([^']+)'/));
    expect(EMAIL_RETURN_TO_MAX).toBe(Number(pick(/RETURN_TO_MAX = (\d+)/)));
    expect(EMAIL_RETURN_TO_RE.toString()).toBe(pick(/RETURN_TO_RE = (\/.+\/u);/));
  });
});
