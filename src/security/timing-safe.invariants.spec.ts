// Security-трипваер: сравнение секретов — только константное по времени
// (security-таск 2026-07-17). Строковое `===`/`!==` на значении, которое
// сверяют с секретом (admin-key, подпись платежа, HMAC initData, CSRF/oauth-
// state токен), делает ранний выход на первом несовпавшем байте — атакующий
// по таймингу побайтово восстанавливает ожидаемое значение. Инвариант:
// каждый известный сайт сравнения секрета использует crypto.timingSafeEqual,
// и allowlist «сравнений-исключений» может только сокращаться.
import { readFileSync } from 'fs';
import { join } from 'path';
import { assertAdminKey } from '../booking/admin-key.util';
import { ForbiddenException } from '@nestjs/common';

const SRC = join(__dirname, '..');

// Файлы, которые ОБЯЗАНЫ сравнивать секрет через timingSafeEqual.
const SECRET_COMPARE_SITES = [
  'booking/admin-key.util.ts',
  'booking/robokassa.service.ts',
  'auth/auth.service.ts',
  'auth/providers/telegram.provider.ts',
];

describe('трипваер: сайты сравнения секретов используют timingSafeEqual', () => {
  it.each(SECRET_COMPARE_SITES)('%s зовёт timingSafeEqual', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    expect(src).toMatch(/timingSafeEqual/);
  });

  // Прямой запрет: ни один из этих файлов не должен сравнивать секрет
  // строковым равенством. Ищем подозрительные `=== ...key/secret/hash/sig`.
  it.each(SECRET_COMPARE_SITES)(
    '%s не сравнивает секрет через ===/!==',
    (rel) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const lines = src.split('\n');
      const offenders = lines
        .map((l, i) => ({ l, i: i + 1 }))
        .filter(
          ({ l }) =>
            /[=!]==/.test(l) &&
            /\b(key|secret|hash|sig|signature|token|hmac)\b/i.test(l) &&
            !l.trimStart().startsWith('//') &&
            // Исключаем безопасные сравнения: с строковым литералом (тип/вид
            // токена: `.kind !== 'merge'`), доступ к payload/type/length/typeof.
            !/[=!]== *['"`]|\.(kind|type)\b|payload\.|\.length|typeof/.test(l),
        );
      expect(offenders.map((o) => `${rel}:${o.i}: ${o.l.trim()}`)).toEqual([]);
    },
  );
});

describe('assertAdminKey — поведение константного сравнения', () => {
  it('верный ключ проходит', () => {
    expect(() => assertAdminKey('super-secret', 'super-secret')).not.toThrow();
  });

  it('неверный ключ той же длины отклоняется', () => {
    expect(() => assertAdminKey('super-secreX', 'super-secret')).toThrow(
      ForbiddenException,
    );
  });

  it('неверная длина отклоняется (без RangeError от timingSafeEqual)', () => {
    expect(() => assertAdminKey('short', 'super-secret')).toThrow(
      ForbiddenException,
    );
  });

  it('пустой сконфигурированный ключ ВСЕГДА отклоняет (missing env не открывает эндпоинт)', () => {
    expect(() => assertAdminKey('', '')).toThrow(ForbiddenException);
    expect(() => assertAdminKey('anything', '')).toThrow(ForbiddenException);
  });

  it('undefined provided отклоняется, не роняет', () => {
    expect(() => assertAdminKey(undefined, 'super-secret')).toThrow(
      ForbiddenException,
    );
  });
});
