// Тест гейта check-persistent-throttle.mjs — «счётчик ручки живёт в Postgres».
//
// Лимит `@Throttle` по умолчанию считается в памяти: деплой обнуляет окно,
// второй инстанс ведёт свой счётчик (правило №5 CLAUDE.md). Аудит 2026-10
// нашёл кодовые и заявочные ручки (merge с TOTP, билеты, подтверждение входа,
// заявка терапевта) без метки `@PersistentThrottle()` — и ни одного решения
// «в память — осознанно». Гейт требует решения о каждой такой ручке; тест
// проверяет оба исхода и контрольные образцы (правило №15).
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { callExport } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const REAL_BASELINE = JSON.parse(
  readFileSync(
    join(ROOT, 'scripts', 'persistent-throttle-baseline.json'),
    'utf8',
  ),
) as Record<string, { status: string; reason: string; since: string }>;

const REASON = 'токен 256 бит, перебор нереален, лимит только против шума';
const exempt = (extra = {}) => ({
  status: 'exempt',
  reason: REASON,
  since: '#708',
  ...extra,
});

const gate = (files: Record<string, string>, baseline: object = {}) =>
  runGate(
    'check-persistent-throttle.mjs',
    {
      ...files,
      'scripts/persistent-throttle-baseline.json': JSON.stringify(baseline),
    },
    { git: true },
  );

const controller = (body: string, head = "@Controller('api/x')") =>
  [`${head}`, 'export class XController {', body, '}', ''].join('\n');

const LIMIT = '@Throttle({ long: { limit: 5, ttl: 60_000 } })';

describe('check-persistent-throttle.mjs', () => {
  it('чистое дерево: метка, составной декоратор, AdminThrottle на классе и exempt — exit 0', () => {
    const res = gate(
      {
        'src/a.controller.ts': controller(
          [
            `  @Post('marked') ${LIMIT} @PersistentThrottle()`,
            '  marked() {}',
            '  @PersistentThrottleLimit({ long: { limit: 5, ttl: 60_000 } })',
            "  @Post('composite')",
            '  composite() {}',
            `  @Post('mem') ${LIMIT}`,
            '  mem() {}',
            "  @Get('plain')",
            '  plain() {}',
          ].join('\n'),
        ),
        'src/b.controller.ts': controller(
          `  @Post('k') ${LIMIT}\n  k() {}`,
          "@AdminThrottle()\n@Controller('api/admin')",
        ),
      },
      { 'POST /api/x/mem': exempt() },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт «счётчик ручки в Postgres»');
  });

  it('ручка с @Throttle без метки и без записи — красное, с именем маршрута', () => {
    const res = gate({
      'src/a.controller.ts': controller(
        `  @Post('code') ${LIMIT}\n  code() {}`,
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/x/code');
  });

  it('метка на соседнем хендлере не лечит немеченый: красное только на нём', () => {
    const res = gate({
      'src/a.controller.ts': controller(
        [
          `  @Post('good') ${LIMIT} @PersistentThrottle()`,
          '  good() {}',
          `  @Post('bad') ${LIMIT}`,
          '  bad(): Promise<{ ok: true }> { return null as never; }',
        ].join('\n'),
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/x/bad');
    expect(res.stderr).not.toContain('POST /api/x/good');
  });

  it('тип возврата с фигурными скобками не сбивает разбор следующего хендлера', () => {
    const res = gate({
      'src/a.controller.ts': controller(
        [
          "  @Post('one')",
          '  @PersistentThrottleLimit({ long: { limit: 5, ttl: 60_000 } })',
          '  async one(): Promise<{ ok: true; n: number }> { return { ok: true, n: 1 }; }',
          `  @Post('two') ${LIMIT}`,
          '  two() {}',
        ].join('\n'),
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/x/two');
    expect(res.stderr).not.toContain('POST /api/x/one');
  });

  // Вызовы, после которых ручка проверяет код человека или гасит токен.
  const TRIGGER_CALLS: [string, string][] = [
    ['verifyCode(', 'await this.totp.verifyCode(uid, dto.code);'],
    ['assertSourceTotp(', 'await assertSourceTotp(this.totp, s, c);'],
    ['confirmSetup(', 'return this.totp.confirmSetup(uid, dto.code);'],
    [
      'regenerateRecoveryCodes(',
      'return this.totp.regenerateRecoveryCodes(uid, dto.code);',
    ],
    ['totp.disable(', 'await this.totp.disable(uid, dto.code);'],
    [
      'consumeEmailToken(',
      'return this.emailTokens.consumeEmailToken(dto.token, req.ip);',
    ],
    ['.approve(', 'return this.links.approve(code, uid);'],
    ['approveLogin', 'await this.t.approveLoginIfPossible(c, u);'],
    ['.deny(', 'await this.t.deny(code);'],
    ['.submit(', 'return this.svc.submit(uid, body);'],
  ];

  it.each(TRIGGER_CALLS)(
    'хендлер без @Throttle, но с %s в теле — красное',
    (_n, call) => {
      const res = gate({
        'src/a.controller.ts': controller(
          `  @Post('act')\n  async act() { ${call} }`,
        ),
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('POST /api/x/act');
    },
  );

  // Обратный исход: тот же хендлер с меткой — зелёный (иначе красный выше мог
  // бы краснеть на любое тело, а не на вызов).
  it.each(TRIGGER_CALLS)(
    'хендлер с %s в теле и составной меткой — зелёное',
    (_n, call) => {
      const res = gate({
        'src/a.controller.ts': controller(
          `  @PersistentThrottleLimit({ long: { limit: 5, ttl: 60_000 } })\n  @Post('act')\n  async act() { ${call} }`,
        ),
      });
      expect(res.status).toBe(0);
    },
  );

  // Контроль: вызовы с похожими именами (не из списка) ручку не затрагивают.
  it.each([
    'return this.totp.verifyCodeSilently(uid);',
    'return this.totp.enable(uid);',
    'return this.cache.consume(token);',
  ])('контроль: хендлер с «%s» без лимита не требует решения', (call) => {
    const res = gate({
      'src/a.controller.ts': controller(
        `  @Post('act')\n  async act() { ${call} }`,
      ),
    });
    expect(res.status).toBe(0);
  });

  it('контроль: @Throttle( и verifyCode( в комментариях не считаются ручкой', () => {
    const res = gate({
      'src/a.controller.ts': controller(
        [
          "  // @Post('x') @Throttle({ long: { limit: 1, ttl: 1 } }) — было так",
          "  @Get('plain')",
          '  plain() { /* раньше тут был verifyCode( */ return 1; }',
        ].join('\n'),
      ),
    });
    expect(res.status).toBe(0);
  });

  it('протухшая запись: маршрута нет — красное', () => {
    const res = gate(
      { 'src/a.controller.ts': controller("  @Get('plain')\n  plain() {}") },
      { 'POST /api/x/gone': exempt() },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи');
    expect(res.stderr).toContain('POST /api/x/gone');
  });

  it('протухшая запись: на маршруте уже стоит метка — красное, с пометкой', () => {
    const res = gate(
      {
        'src/a.controller.ts': controller(
          `  @Post('now') ${LIMIT} @PersistentThrottle()\n  now() {}`,
        ),
      },
      { 'POST /api/x/now': exempt() },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/x/now  (метка уже стоит)');
  });

  it('снятая метка с бывшей persistent-ручки краснеет сама', () => {
    const withMark = controller(
      `  @Post('book') ${LIMIT} @PersistentThrottle()\n  book() {}`,
    );
    expect(gate({ 'src/a.controller.ts': withMark }).status).toBe(0);
    const res = gate({
      'src/a.controller.ts': withMark.replace(' @PersistentThrottle()', ''),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/x/book');
  });

  it.each([
    ['короче 20 символов', exempt({ reason: 'не страшно' }), 'короче 20'],
    [
      'слово «legacy»',
      exempt({ reason: 'legacy-ручка, не трогаем пока' }),
      'legacy',
    ],
    ['пустой since', exempt({ since: '' }), 'since'],
    ['чужой status', exempt({ status: 'leader' }), 'status'],
  ])('запись с плохой причиной (%s) — красное', (_n, entry, expected) => {
    const res = gate(
      {
        'src/a.controller.ts': controller(
          `  @Post('mem') ${LIMIT}\n  mem() {}`,
        ),
      },
      { 'POST /api/x/mem': entry },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(expected);
  });

  it('отсутствие бейслайна — красное, а не молчаливый ноль', () => {
    const res = runGate(
      'check-persistent-throttle.mjs',
      { 'src/a.controller.ts': controller("  @Get('p')\n  p() {}") },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  // Пин реального бейслайна (правило №15 п.2): у каждой exempt-записи есть
  // образец, который она гасит, И контрольный — тот же маршрут без записи
  // обязан остаться красным.
  describe('реальный бейслайн: каждая запись гасит свой образец и только его', () => {
    const entries = Object.entries(REAL_BASELINE);

    it('бейслайн непуст', () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries)('%s', (key, entry) => {
      const [method, path] = key.split(' ');
      const files = {
        'src/a.controller.ts': [
          '@Controller()',
          'export class XController {',
          `  @${method[0]}${method.slice(1).toLowerCase()}('${path}') ${LIMIT}`,
          '  h() {}',
          '}',
          '',
        ].join('\n'),
      };
      expect(entry.status).toBe('exempt');
      expect(gate(files, { [key]: entry }).status).toBe(0);
      const control = gate(files, {});
      expect(control.status).toBe(1);
      expect(control.stderr).toContain(key);
    });
  });

  it('реальное дерево: гейт зелёный', () => {
    const res = spawnSync(
      'node',
      [join(ROOT, 'scripts', 'check-persistent-throttle.mjs')],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });
  // Шов: разбор настоящего контроллера, а не выдуманного (правило №14).
  it('настоящий auth-account.controller: зелёный; снять метку с merge — красное', () => {
    const real = readFileSync(
      join(ROOT, 'src', 'auth', 'auth-account.controller.ts'),
      'utf8',
    );
    const baseline = {
      'POST /api/auth/email/consume':
        REAL_BASELINE['POST /api/auth/email/consume'],
      'POST /api/auth/telegram/webapp':
        REAL_BASELINE['POST /api/auth/telegram/webapp'],
    };
    expect(gate({ 'src/auth/a.controller.ts': real }, baseline).status).toBe(0);

    const mark = '@PersistentThrottleLimit(STRICT_THROTTLE)';
    const at = real.indexOf("@Post('merge')");
    const idx = real.indexOf(mark, at);
    expect(idx).toBeGreaterThan(at);
    const stripped =
      real.slice(0, idx) +
      '@Throttle(STRICT_THROTTLE)' +
      real.slice(idx + mark.length);
    const res = gate({ 'src/auth/a.controller.ts': stripped }, baseline);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('POST /api/auth/merge');
    expect(res.stderr).not.toContain('POST /api/auth/email/link');
  });

  // Шаг, ради которого расширен TRIGGERS: снять и лимит, и метку с ручки,
  // что проверяет TOTP-код, — гейт обязан покраснеть сам, а не промолчать,
  // оставив хендлер на глобальных 200 в минуту в памяти.
  it.each([
    ['2fa/enable', 'totpEnable', 'POST /api/auth/2fa/enable'],
    ['2fa/disable', 'totpDisable', 'POST /api/auth/2fa/disable'],
    [
      '2fa/recovery-codes',
      'totpRegenerateRecovery',
      'POST /api/auth/2fa/recovery-codes',
    ],
  ])(
    'настоящий auth-2fa.controller: без лимита и метки на %s — красное, с меткой — зелёное',
    (_route, method, key) => {
      const real = readFileSync(
        join(ROOT, 'src', 'auth', 'auth-2fa.controller.ts'),
        'utf8',
      );
      // Исключений у контроллера нет: каждая ручка с кодом несёт метку.
      const baseline = {};
      expect(gate({ 'src/auth/a.controller.ts': real }, baseline).status).toBe(
        0,
      );

      const mark = '  @PersistentThrottleLimit(CODE_THROTTLE)\n';
      const at = real.indexOf(`async ${method}(`);
      const idx = real.lastIndexOf(mark, at);
      expect(at).toBeGreaterThan(0);
      expect(idx).toBeGreaterThan(real.lastIndexOf('@Post(', at));
      const stripped = real.slice(0, idx) + real.slice(idx + mark.length);
      const res = gate({ 'src/auth/a.controller.ts': stripped }, baseline);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(key);
    },
  );
});

// Модуль разбора (persistent-throttle-parse.mjs) проверяется и напрямую: гейт
// выше видит только итог «зелёный/красный», а ошибка разбора (потерянный
// хендлер, чужая метка) прячется за зелёным.
interface Parsed {
  handlers: {
    key: string;
    marked: boolean;
    throttled: boolean;
    triggers: boolean;
  }[];
  expected: number;
}
const parse = (src: string): Parsed =>
  callExport(
    'persistent-throttle-parse.mjs',
    'parseControllerFile',
    src,
  ) as unknown as Parsed;

describe('persistent-throttle-parse.mjs: parseControllerFile', () => {
  const byKey = (p: Parsed, key: string) =>
    p.handlers.find((h) => h.key === key);

  it('метка до и после @Post, префикс контроллера и параметр маршрута', () => {
    const p = parse(
      [
        "@Controller('api/x')",
        'export class A {',
        "  @PersistentThrottle() @Throttle({}) @Post(':id/go') go() {}",
        "  @Delete(':id') @Throttle({}) @PersistentThrottle() del() {}",
        '}',
      ].join('\n'),
    );
    expect(p.expected).toBe(2);
    expect(byKey(p, 'POST /api/x/:param/go')).toMatchObject({
      marked: true,
      throttled: true,
    });
    expect(byKey(p, 'DELETE /api/x/:param')?.marked).toBe(true);
  });

  it('AdminThrottle на классе метит все хендлеры класса', () => {
    const p = parse(
      "@AdminThrottle()\n@Controller('a')\nexport class A { @Get() g() {} @Post('p') p() {} }",
    );
    expect(p.handlers.map((h) => h.marked)).toEqual([true, true]);
    expect(p.handlers.map((h) => h.key)).toEqual(['GET /a', 'POST /a/p']);
  });

  it('свойства, конструктор и приватные методы между хендлерами не сбивают разбор', () => {
    const p = parse(
      [
        "@Controller('a')",
        'export class A {',
        '  private readonly logger = new Logger(A.name);',
        '  constructor(private readonly s: S, @Inject(X) private readonly y: Y) {}',
        "  @Post('one') @Throttle({}) async one(): Promise<{ ok: true; n: number }> { return { ok: true, n: 1 }; }",
        '  private helper(): { a: number } { return { a: 1 }; }',
        "  @Post('two') two() { return this.s.submit(1); }",
        '}',
      ].join('\n'),
    );
    expect(p.handlers).toHaveLength(p.expected);
    expect(byKey(p, 'POST /a/one')).toMatchObject({
      throttled: true,
      triggers: false,
    });
    expect(byKey(p, 'POST /a/two')).toMatchObject({
      throttled: false,
      triggers: true,
    });
  });

  it('контроль: декоратор в комментарии не считается, а число хендлеров сходится с ожидаемым', () => {
    const p = parse(
      "@Controller('a')\nexport class A {\n  // @Post('ghost') @PersistentThrottle()\n  @Get('real') real() {}\n}",
    );
    expect(p.handlers.map((h) => h.key)).toEqual(['GET /a/real']);
    expect(p.expected).toBe(1);
  });
});
