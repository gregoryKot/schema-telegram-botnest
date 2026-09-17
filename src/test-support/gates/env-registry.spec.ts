// Тест гейта check-env-registry.mjs — реестр env-переменных (щит, инциденты
// 2026-09-15/16). Гейт требует, чтобы каждое чтение env-переменной в src/**
// ссылалось на запись реестра, и чтобы каждая запись реестра реально
// читалась где-то — иначе она протухла (правило №16, тот же принцип).
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const REGISTRY_FIXTURE = [
  "import { EnvVarSpec, formats } from './env-registry';",
  '',
  'export const AUTH_ENV_ENTRIES: EnvVarSpec[] = [',
  '  {',
  "    name: 'FOO_TOKEN',",
  "    purpose: 'тестовая запись',",
  '    requiredInProd: false,',
  '    format: formats.nonEmpty,',
  "    group: 'auth',",
  '  },',
  '];',
  '',
].join('\n');

describe('check-env-registry.mjs', () => {
  it('незарегистрированная переменная (process.env.X) — exit 1, называет имя и файл', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/some.service.ts': [
        'export function readIt() {',
        '  return process.env.BAR_TOKEN;',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('BAR_TOKEN');
    expect(res.stderr).toContain('src/some.service.ts');
  });

  it('переменная зарегистрирована и реально читается (process.env.X) — exit 0', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/some.service.ts': [
        'export function readIt() {',
        '  return process.env.FOO_TOKEN;',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 переменных прочитано');
  });

  it('протухшая запись реестра (нигде не читается) — exit 1', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/some.service.ts': [
        "export function noop() { return 'no env here'; }",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи');
    expect(res.stderr).toContain('FOO_TOKEN');
  });

  it('bracket-доступ через локальный const (process.env[CONST]) резолвится к имени', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/channel/some.target.ts': [
        "const TOKEN_ENV = 'FOO_TOKEN';",
        'export function readIt() {',
        '  return process.env[TOKEN_ENV];',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it("config.getOrThrow<string>('X') считается чтением", () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/some.provider.ts': [
        'export function readIt(config: { getOrThrow<T>(k: string): T }) {',
        "  return config.getOrThrow<string>('FOO_TOKEN');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('массив-константа *_ENVS регистрирует все свои литералы разом', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      'src/auth/some.provider.ts': [
        "const TOKEN_ENVS = ['FOO_TOKEN'] as const;",
        'export function readIt(config: { get(k: string): string | undefined }) {',
        '  return TOKEN_ENVS.map((k) => config.get(k)).find(Boolean);',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('спек-файл и test-support не гейтятся', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts': REGISTRY_FIXTURE,
      // Держит FOO_TOKEN не протухшим — сам тест проверяет, что переменные
      // из спек-файлов ниже НЕ требуют регистрации и не гейтятся.
      'src/some.service.ts': 'export const x = process.env.FOO_TOKEN;\n',
      'src/some.service.spec.ts': "process.env.UNREGISTERED_IN_SPEC = 'x';",
      'src/test-support/gates/some.spec.ts':
        "process.env.ALSO_UNREGISTERED = 'x';",
      // Не-спек файл, но внутри test-support/ — тоже исключённое дерево
      // (гейт-хелперы читают env для собственных фикстур, это не проектная
      // конфигурация).
      'src/test-support/gates/gate-helper.ts': "process.env.HELPER_ONLY = 'x';",
    });
    expect(res.status).toBe(0);
  });

  it('чистое дерево без реестра и без источников — exit 0, ноль записей', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/some.service.ts': 'export const x = 1;',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 переменных прочитано');
  });
});

// Системные исключения (NODE_ENV/PATH/TZ/HOSTNAME/PORT) — правило №15:
// список без теста на своё имя и без контрольного образца — замалчивание.
describe('SYSTEM_ENV_EXEMPT', () => {
  const SYSTEM_ENV_EXEMPT = loadStringList(
    'check-env-registry.mjs',
    'SYSTEM_ENV_EXEMPT',
  );

  it('непустой и содержит только ожидаемые системные имена', () => {
    expect(SYSTEM_ENV_EXEMPT).toEqual(
      expect.arrayContaining(['NODE_ENV', 'PATH', 'TZ', 'HOSTNAME', 'PORT']),
    );
  });

  it.each(SYSTEM_ENV_EXEMPT.map((name) => [name] as const))(
    'образец: чтение %s без регистрации в реестре — exit 0',
    (name) => {
      const res = runGate('check-env-registry.mjs', {
        'src/infra/env-registry.entries.auth.ts':
          'export const AUTH_ENV_ENTRIES = [];\n',
        'src/some.service.ts': `export const x = process.env.${name};\n`,
      });
      expect(res.status).toBe(0);
    },
  );

  it('контрольный образец: похожее, но НЕ системное имя всё равно краснеет', () => {
    const res = runGate('check-env-registry.mjs', {
      'src/infra/env-registry.entries.auth.ts':
        'export const AUTH_ENV_ENTRIES = [];\n',
      'src/some.service.ts': 'export const x = process.env.PORTAL_TOKEN;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('PORTAL_TOKEN');
  });
});
