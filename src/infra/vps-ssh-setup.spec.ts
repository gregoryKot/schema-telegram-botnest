// Логика deploy/vps/ssh-setup.sh (ssh-алиас `vps` на раннере Actions) с
// поддельным ssh-keyscan в PATH и HOME во временном каталоге. Что настоящий
// ssh сумеет подключиться по этому конфигу, здесь не проверяется (это делает
// первый живой деплой); проверяется то, что скрипт решает САМ: права на ключ,
// откуда берётся known_hosts, какой конфиг пишется и что не попадает в лог
// Actions (он публичный). Ключ с правами шире 600 ssh отвергает целиком, а
// known_hosts из keyscan — единственная защита от подмены сервера, поэтому
// выбор между секретом и keyscan не должен зависеть от памяти автора.
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCRIPT = join(process.cwd(), 'deploy', 'vps', 'ssh-setup.sh');
const HOST = 'vps.example.test';
const KEY = [
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  'SECRETKEYBODYLINE1abcdef',
  'SECRETKEYBODYLINE2ghijkl',
  '-----END OPENSSH PRIVATE KEY-----',
].join('\n');
const SECRET_KNOWN_HOSTS = `${HOST} ssh-ed25519 AAAAFROMSECRET`;
const KEYSCAN_LINE = `${HOST} ssh-ed25519 AAAAFROMKEYSCAN`;

// Поддельный ssh-keyscan: пишет вызов в $FAKE_LOG, отдаёт строку known_hosts
// (или ничего, если FAKE_KEYSCAN_EMPTY=1 — сервер недоступен).
const FAKE_KEYSCAN = `#!/bin/bash
echo "ssh-keyscan $*" >> "$FAKE_LOG"
[ "\${FAKE_KEYSCAN_EMPTY:-0}" = "1" ] || echo "${KEYSCAN_LINE}"
exit 0
`;

describe('deploy/vps/ssh-setup.sh', () => {
  let dir: string;
  let home: string;
  let log: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vps-ssh-'));
    home = join(dir, 'home');
    log = join(dir, 'calls.log');
    const bin = join(dir, 'bin');
    mkdirSync(home);
    mkdirSync(bin);
    writeFileSync(join(bin, 'ssh-keyscan'), FAKE_KEYSCAN, { mode: 0o755 });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const ssh = (f: string) => join(home, '.ssh', f);
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');
  const mode = (p: string) => (statSync(p).mode & 0o777).toString(8);

  function run(env: Record<string, string | undefined>) {
    const base: NodeJS.ProcessEnv = { ...process.env };
    delete base.DEPLOY_HOST;
    delete base.DEPLOY_SSH_KEY;
    delete base.DEPLOY_KNOWN_HOSTS;
    delete base.SSH_USER;
    return spawnSync('bash', [SCRIPT], {
      env: {
        ...base,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        HOME: home,
        FAKE_LOG: log,
        ...env,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }
  const full = (extra: Record<string, string> = {}) =>
    run({ DEPLOY_HOST: HOST, DEPLOY_SSH_KEY: KEY, ...extra });

  it('ключ записан целиком и с правами 600, каталог ~/.ssh закрыт для остальных', () => {
    const res = full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });

    expect(res.status).toBe(0);
    expect(readFileSync(ssh('id_deploy'), 'utf8')).toBe(`${KEY}\n`);
    expect(mode(ssh('id_deploy'))).toBe('600');
    expect(mode(join(home, '.ssh'))).toBe('700');
    expect(mode(ssh('config'))).toBe('600');
  });

  it('known_hosts из секрета: берётся как есть, keyscan не зовётся, предупреждения нет', () => {
    const res = full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });

    expect(res.status).toBe(0);
    expect(readFileSync(ssh('known_hosts'), 'utf8')).toBe(
      `${SECRET_KNOWN_HOSTS}\n`,
    );
    expect(calls()).toBe('');
    expect(res.stdout + res.stderr).not.toContain('::warning::');
  });

  it('known_hosts не задан: отпечаток из keyscan по адресу сервера, в лог идёт предупреждение', () => {
    const res = full();

    expect(res.status).toBe(0);
    expect(readFileSync(ssh('known_hosts'), 'utf8')).toBe(`${KEYSCAN_LINE}\n`);
    expect(calls()).toBe(`ssh-keyscan -T 15 -t ed25519,rsa,ecdsa ${HOST}\n`);
    expect(res.stdout).toMatch(/::warning::DEPLOY_KNOWN_HOSTS не задан/);
  });

  it('пустая строка в DEPLOY_KNOWN_HOSTS равна «не задан»: идёт keyscan', () => {
    const res = full({ DEPLOY_KNOWN_HOSTS: '' });

    expect(res.status).toBe(0);
    expect(readFileSync(ssh('known_hosts'), 'utf8')).toBe(`${KEYSCAN_LINE}\n`);
    expect(res.stdout).toContain('::warning::');
  });

  it('keyscan ничего не вернул: ошибка Actions и код 1, а не пустой known_hosts', () => {
    const res = full({ FAKE_KEYSCAN_EMPTY: '1' });

    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/::error::ssh-keyscan не получил ключ/);
  });

  it('ssh-конфиг описывает хост vps: адрес, root, ключ, строгая проверка хоста, без вопросов', () => {
    full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });
    const conf = readFileSync(ssh('config'), 'utf8');
    const line = (key: string) =>
      conf.match(new RegExp(`^\\s+${key} (.*)$`, 'm'))?.[1];

    expect(conf).toMatch(/^Host vps$/m);
    expect(line('HostName')).toBe(HOST);
    expect(line('User')).toBe('root');
    expect(line('IdentityFile')).toBe('~/.ssh/id_deploy');
    expect(line('IdentitiesOnly')).toBe('yes');
    expect(line('UserKnownHostsFile')).toBe('~/.ssh/known_hosts');
    expect(line('StrictHostKeyChecking')).toBe('yes');
    expect(line('BatchMode')).toBe('yes');
    // ssh читает этот конфиг по ключу `vps`: второго блока Host быть не должно
    expect(conf.match(/^Host /gm)).toHaveLength(1);
  });

  describe('SSH_USER (под кем заходить)', () => {
    const userLine = () =>
      readFileSync(ssh('config'), 'utf8').match(/^\s+User (.*)$/m)?.[1];

    it('не задан или пуст: User root', () => {
      full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });
      expect(userLine()).toBe('root');

      full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS, SSH_USER: '' });
      expect(userLine()).toBe('root');
    });

    it.each(['ubuntu', 'cloud-user', '_svc', 'user01', 'a'.repeat(32)])(
      'SSH_USER=%s попадает в User, блок Host остаётся один',
      (name) => {
        const res = full({
          DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS,
          SSH_USER: name,
        });

        expect(res.status).toBe(0);
        expect(userLine()).toBe(name);
        expect(
          readFileSync(ssh('config'), 'utf8').match(/^Host /gm),
        ).toHaveLength(1);
      },
    );

    it.each([
      ['с пробелом', 'bad user'],
      ['перевод строки с чужой директивой', 'root\nProxyCommand evil'],
      ['заглавные', 'Ubuntu'],
      ['с цифры', '1user'],
      ['с дефиса', '-oProxyCommand=evil'],
      ['с точкой и слэшем', '../root'],
      ['длиннее 32 знаков', 'a'.repeat(33)],
      ['с ;', 'root;id'],
    ])('имя %s — ошибка Actions, код 1, ~/.ssh не создан', (_why, name) => {
      const res = full({ SSH_USER: name });

      expect(res.status).toBe(1);
      expect(res.stdout).toMatch(/::error::SSH_USER не похож на имя/);
      expect(existsSync(join(home, '.ssh'))).toBe(false);
      expect(calls()).toBe('');
    });
  });

  it('ключ и known_hosts не попадают ни в stdout, ни в stderr (оба режима)', () => {
    const withSecret = full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });
    const withScan = full();

    for (const res of [withSecret, withScan]) {
      const out = res.stdout + res.stderr;
      expect(out).not.toContain('SECRETKEYBODYLINE');
      expect(out).not.toContain('PRIVATE KEY');
      expect(out).not.toContain('AAAAFROM');
    }
  });

  it.each([
    ['DEPLOY_HOST', { DEPLOY_SSH_KEY: KEY }],
    ['DEPLOY_SSH_KEY', { DEPLOY_HOST: HOST }],
    ['DEPLOY_HOST', { DEPLOY_HOST: '', DEPLOY_SSH_KEY: KEY }],
    ['DEPLOY_SSH_KEY', { DEPLOY_HOST: HOST, DEPLOY_SSH_KEY: '' }],
  ])(
    'нет обязательной %s: код 1, ~/.ssh не создан, keyscan не зовётся',
    (name, env) => {
      const res = run(env);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain(name);
      expect(existsSync(join(home, '.ssh'))).toBe(false);
      expect(calls()).toBe('');
    },
  );

  it('повторный запуск на раннере с уже лежащим ключом перезаписывает его и оставляет 600', () => {
    full({ DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS });
    const NEW_KEY = 'NEWKEYLINE';

    const res = run({
      DEPLOY_HOST: HOST,
      DEPLOY_SSH_KEY: NEW_KEY,
      DEPLOY_KNOWN_HOSTS: SECRET_KNOWN_HOSTS,
    });

    expect(res.status).toBe(0);
    expect(readFileSync(ssh('id_deploy'), 'utf8')).toBe(`${NEW_KEY}\n`);
    expect(mode(ssh('id_deploy'))).toBe('600');
  });
});
