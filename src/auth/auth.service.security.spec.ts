// Security-тесты: попытки подделки JWT (SECURITY.md, аудит токенов).
// Цель — доказать, что verifyAccessToken/verifyLinkToken/verifyMergeToken/
// verifyTotpChallengeToken отклоняют любую форму подделки, а не просто
// "работают на happy path" (это уже покрыто auth.service.spec.ts).
//
// AuthService берётся настоящий, токены подделываются в тесте напрямую
// через jsonwebtoken/ручную сборку сегментов — как в jwt.guard.spec.ts.
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { AuthService } from './auth.service';

const JWT_SECRET = 'test-jwt-secret';
const ISSUER = 'schemehappens.ru';
const AUDIENCE = 'schemehappens.ru';

function makeService(): AuthService {
  const config = { getOrThrow: () => JWT_SECRET } as any;
  return new AuthService({} as any, config, {} as any, {} as any);
}

// Подписать "честный" токен произвольным набором полей — как это делает
// AuthService, но с полным контролем над каждым параметром для атак.
function sign(
  payload: Record<string, unknown>,
  opts: {
    secret?: string;
    algorithm?: jwt.Algorithm;
    issuer?: string;
    audience?: string;
    noIssuer?: boolean; // не ставить iss вообще (не то же самое, что issuer: undefined)
    noAudience?: boolean; // не ставить aud вообще
    expiresIn?: number;
    notBefore?: number;
  } = {},
): string {
  const signOpts: jwt.SignOptions = {
    algorithm: opts.algorithm ?? 'HS256',
    expiresIn: opts.expiresIn ?? 900,
  };
  if (!opts.noIssuer) signOpts.issuer = opts.issuer ?? ISSUER;
  if (!opts.noAudience) signOpts.audience = opts.audience ?? AUDIENCE;
  if (opts.notBefore !== undefined) signOpts.notBefore = opts.notBefore;
  return jwt.sign(payload, opts.secret ?? JWT_SECRET, signOpts);
}

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

// Все 4 верифицирующих метода AuthService, с "честным" полем-дискриминатором.
type Verifier = { name: string; fn: (t: string) => unknown };
function verifiers(svc: AuthService): Verifier[] {
  return [
    { name: 'verifyAccessToken', fn: (t) => svc.verifyAccessToken(t) },
    { name: 'verifyLinkToken', fn: (t) => svc.verifyLinkToken(t) },
    { name: 'verifyMergeToken', fn: (t) => svc.verifyMergeToken(t) },
    {
      name: 'verifyTotpChallengeToken',
      fn: (t) => svc.verifyTotpChallengeToken(t),
    },
  ];
}

describe('AuthService — устойчивость к подделке JWT', () => {
  describe('1. alg:none', () => {
    it('токен с header {alg:"none"} и без подписи отклоняется', () => {
      const svc = makeService();
      const header = b64url({ alg: 'none', typ: 'JWT' });
      const payload = b64url({
        sub: '123',
        type: 'access',
        iss: ISSUER,
        aud: AUDIENCE,
      });
      const forged = `${header}.${payload}.`; // пустая подпись
      expect(() => svc.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });

    it('CONFIRMED: verify закреплён на algorithms:["HS256"] (grep source) — alg:none в принципе не может пройти jsonwebtoken.verify', () => {
      // Реальная проверка через исходники — все 4 verify*-метода передают
      // { algorithms: ['HS256'] } третьим аргументом jwt.verify. Это и есть
      // механизм, из-за которого тест выше проходит: jsonwebtoken отвергает
      // header.alg, не входящий в переданный список, до всякой проверки подписи.
      const src = fs.readFileSync(require.resolve('./auth.service.ts'), 'utf8');
      const verifyCalls = src.match(/jwt\.verify\(/g) ?? [];
      const pinnedCalls = src.match(/algorithms:\s*\[['"]HS256['"]\]/g) ?? [];
      expect(pinnedCalls.length).toBe(verifyCalls.length);
    });
  });

  describe('2. Путаница алгоритмов HS256/HS512', () => {
    it('токен, подписанный тем же секретом, но алгоритмом HS512, отклоняется', () => {
      const svc = makeService();
      const forged = sign(
        { sub: '123', type: 'access' },
        { algorithm: 'HS512' },
      );
      expect(() => svc.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });
    // Асимметричные алгоритмы (RS/ES256 и т.п.) в проекте не используются
    // нигде (grep по src/ — единственный jwt.verify/sign в auth.service.ts,
    // везде HS256) — классическая атака "публичный ключ как HMAC-секрет"
    // неприменима, отдельный тест не нужен.
  });

  describe('3. Путаница типа токена (все 4×4 комбинации verify×token)', () => {
    const svc = makeService();
    const tokens: Record<string, string> = {
      access: sign({ sub: '1', type: 'access' }),
      link: sign({ sub: '1', type: 'link' }),
      merge: sign({
        kind: 'merge',
        target: '1',
        source: '2',
        provider: 'google',
        providerId: 'g-1',
      }),
      totp: sign({ kind: 'totp_challenge', sub: '1', ip: null, ua: '' }),
    };
    const expected: Record<string, string> = {
      verifyAccessToken: 'access',
      verifyLinkToken: 'link',
      verifyMergeToken: 'merge',
      verifyTotpChallengeToken: 'totp',
    };

    for (const v of verifiers(svc)) {
      for (const [kind, token] of Object.entries(tokens)) {
        const shouldPass = expected[v.name] === kind;
        it(`${v.name}(${kind}-токен) → ${shouldPass ? 'принят' : 'отклонён'}`, () => {
          if (shouldPass) {
            expect(() => v.fn(token)).not.toThrow();
          } else {
            expect(() => v.fn(token)).toThrow(UnauthorizedException);
          }
        });
      }
    }
  });

  describe('4. Чужой issuer/audience', () => {
    const svc = makeService();
    it.each([
      ['issuer = attacker.example', { issuer: 'attacker.example' }],
      ['audience = attacker.example', { audience: 'attacker.example' }],
      ['issuer отсутствует в payload', { noIssuer: true }],
      ['audience отсутствует в payload', { noAudience: true }],
    ])('%s → отклонён', (_name, opts) => {
      const forged = sign({ sub: '1', type: 'access' }, opts);
      expect(() => svc.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('5. Истёкшие / nbf-в-будущем токены', () => {
    const svc = makeService();
    it('уже истёкший (expiresIn отрицательный) отклоняется', () => {
      const forged = sign({ sub: '1', type: 'access' }, { expiresIn: -10 });
      expect(() => svc.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });

    it('nbf в будущем (даже с валидной подписью) отклоняется — jsonwebtoken проверяет nbf, если он есть в payload, даже когда AuthService сам его не выставляет', () => {
      const forged = sign({ sub: '1', type: 'access' }, { notBefore: 3600 });
      expect(() => svc.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('6. Подмена одного байта в payload', () => {
    it('изменённый (но синтаксически валидный) payload при сохранённых header/signature отклоняется', () => {
      const svc = makeService();
      const good = sign({ sub: '1', type: 'access' });
      const [header, payload, sig] = good.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      decoded.sub = '999999999999'; // повышаем себе привилегии подменой userId
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString(
        'base64url',
      );
      const tampered = `${header}.${tamperedPayload}.${sig}`;
      expect(() => svc.verifyAccessToken(tampered)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('7. Мусорные/пустые/битые строки токена', () => {
    const svc = makeService();
    it.each([
      ['пустая строка', ''],
      ['null-строка', 'null'],
      ['undefined-строка', 'undefined'],
      ['без точек', 'notajwttoken'],
      ['один сегмент', 'abc'],
      ['два сегмента (нет подписи)', 'abc.def'],
      ['четыре сегмента', 'a.b.c.d'],
      ['огромный токен (100k символов)', 'a'.repeat(100_000)],
      ['валидная структура, мусорный base64', 'a.b.c'],
    ])('%s → UnauthorizedException, без падения процесса', (_name, token) => {
      expect(() => svc.verifyAccessToken(token)).toThrow(UnauthorizedException);
    });
  });

  describe('8. Подозрительный sub — BigInt(sub) не должен падать "сырой" ошибкой', () => {
    const svc = makeService();

    it('нечисловой sub → чисто UnauthorizedException (не SyntaxError из BigInt наружу)', () => {
      const forged = sign({ sub: 'not-a-number', type: 'access' });
      let caught: unknown;
      try {
        svc.verifyAccessToken(forged);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UnauthorizedException);
      // Сообщение — общее, без утечки текста внутренней ошибки BigInt.
      expect((caught as UnauthorizedException).message).toBe(
        'Invalid or expired access token',
      );
    });

    it('отрицательный sub — BigInt съедает без падения (валиден как BigInt, не сигнатурная дыра)', () => {
      const forged = sign({ sub: '-5', type: 'access' });
      const result = svc.verifyAccessToken(forged);
      expect(result.userId).toBe(-5n);
    });

    it('гигантский sub — BigInt съедает без падения процесса', () => {
      const huge = '9'.repeat(200);
      const forged = sign({ sub: huge, type: 'access' });
      const result = svc.verifyAccessToken(forged);
      expect(result.userId).toBe(BigInt(huge));
    });

    it('пустой sub → BigInt("") = 0n, не падает', () => {
      const forged = sign({ sub: '', type: 'access' });
      const result = svc.verifyAccessToken(forged);
      expect(result.userId).toBe(0n);
    });
  });
});
