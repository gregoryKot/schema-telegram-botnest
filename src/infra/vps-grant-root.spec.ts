// Логика deploy/vps/grant-root.sh (разовая выдача ssh-доступа под root у
// провайдеров, где по ssh пускают только sudo-пользователя) с поддельными
// sudo/sshd/systemctl/install в PATH. Корни /root и /etc подменяются
// GRANT_ROOT_HOME и GRANT_ETC, HOME — песочница. Что настоящий sshd перечитает
// конфиг, а install выставит владельца root, здесь не проверяется (это делает
// первый живой op=grant-root и проверка `id -u` под root в vps.yml);
// проверяется то, что скрипт решает САМ: что и с какими правами положить в
// root, когда нужен drop-in, когда НЕ нужен, что не печатать (лог Actions
// публичный) и что НЕ трогать, если переносить нечего (иначе замена файла
// закрыла бы последний вход).
// Не покрыто (нужен root и настоящий sshd): владелец файлов (в журнале виден
// только `-o root -g root`), порядок include в настоящем sshd_config.
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

const SCRIPT = join(process.cwd(), 'deploy', 'vps', 'grant-root.sh');
const LOG = (n: string) => `echo "${n} $*" >> "$FAKE_LOG"`;
const USER_KEYS = [
  'ssh-ed25519 AAAAUSERKEYBODY1 github-actions',
  'ssh-ed25519 AAAAUSERKEYBODY2 owner-laptop',
].join('\n');
const CLOUD_INIT_STUB =
  'no-port-forwarding,command="echo \'Please login as the user ubuntu rather than root.\';echo;sleep 10;exit 142" ssh-rsa AAAASTUBKEY cloud\n';

// sudo: пишет вызов, `-n` снимает, дальше выполняет команду (в песочнице мы не
// root, а пути уже подменены). FAKE_NO_SUDO=1 — пароль спросили бы, `-n` падает.
// install: разбирает -d/-m, -o/-g пропускает (владельца не проверить без root,
// флаги видны в журнале). sshd -T: drop-in действует, если не FAKE_DROPIN_IGNORED.
const FAKES: Record<string, string> = {
  sudo: `${LOG('sudo')}
[ "\${FAKE_NO_SUDO:-0}" = "1" ] && exit 1
[ "$1" = "-n" ] && shift
exec "$@"`,
  install: `${LOG('install')}
mode=755; dir=0; args=()
while [ $# -gt 0 ]; do
  case "$1" in -d) dir=1 ;; -m) mode=$2; shift ;; -o|-g) shift ;; *) args+=("$1") ;; esac
  shift
done
if [ $dir = 1 ]; then mkdir -p "\${args[0]}"; chmod "$mode" "\${args[0]}"
else cp "\${args[0]}" "\${args[1]}"; chmod "$mode" "\${args[1]}"; fi`,
  sshd: `${LOG('sshd')}
case "$1" in
  -t) [ "\${FAKE_SSHD_T_FAIL:-0}" != "1" ] ;;
  -T)
    [ "\${FAKE_SSHD_T_EMPTY:-0}" = "1" ] && exit 1
    v="\${FAKE_PERMITROOT:-prohibit-password}"
    if [ -e "$GRANT_ETC/ssh/sshd_config.d/10-schemehappens-root.conf" ] && [ "\${FAKE_DROPIN_IGNORED:-0}" != "1" ]; then v=prohibit-password; fi
    printf 'port 22\\npermitrootlogin %s\\npasswordauthentication no\\n' "$v" ;;
esac`,
  systemctl: `${LOG('systemctl')}
[ "$1 $2" = "reload ssh" ] && [ "\${FAKE_SSH_UNIT:-ssh}" = "sshd" ] && exit 5
exit 0`,
};

describe('deploy/vps/grant-root.sh', () => {
  let dir: string;
  const home = () => join(dir, 'home');
  const rootHome = () => join(dir, 'root');
  const etc = () => join(dir, 'etc');
  const rootKeys = () => join(rootHome(), '.ssh', 'authorized_keys');
  const dropin = () =>
    join(etc(), 'ssh', 'sshd_config.d', '10-schemehappens-root.conf');
  const mode = (p: string) => (statSync(p).mode & 0o777).toString(8);
  const read = (p: string) => readFileSync(p, 'utf8');
  const journal = () =>
    existsSync(join(dir, 'journal'))
      ? read(join(dir, 'journal')).split('\n').filter(Boolean)
      : [];
  const calls = (prefix: string) =>
    journal().filter((l) => l.startsWith(`${prefix} `));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vps-grant-root-'));
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(home(), '.ssh'), { recursive: true });
    writeFileSync(join(home(), '.ssh', 'authorized_keys'), `${USER_KEYS}\n`);
    for (const [name, body] of Object.entries(FAKES)) {
      writeFileSync(join(dir, 'bin', name), `#!/bin/bash\n${body}\n`, {
        mode: 0o755,
      });
    }
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function run(env: Record<string, string> = {}) {
    return spawnSync('bash', [SCRIPT], {
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        HOME: home(),
        GRANT_ROOT_HOME: rootHome(),
        GRANT_ETC: etc(),
        FAKE_LOG: join(dir, 'journal'),
        ...env,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  describe('ключи', () => {
    it('ключи пользователя переносятся в root: содержимое то же, файл 600, каталог 700, владелец root', () => {
      const res = run();

      expect(res.status).toBe(0);
      expect(read(rootKeys())).toBe(`${USER_KEYS}\n`);
      expect(mode(rootKeys())).toBe('600');
      expect(mode(join(rootHome(), '.ssh'))).toBe('700');
      expect(calls('install')).toEqual(
        expect.arrayContaining([
          `install -d -m 700 -o root -g root ${join(rootHome(), '.ssh')}`,
          `install -m 600 -o root -g root ${join(home(), '.ssh', 'authorized_keys')} ${rootKeys()}`,
        ]),
      );
    });

    it('заглушка cloud-init command= заменяется, а не дополняется', () => {
      mkdirSync(join(rootHome(), '.ssh'), { recursive: true });
      writeFileSync(rootKeys(), CLOUD_INIT_STUB);

      const res = run();

      expect(res.status).toBe(0);
      const after = read(rootKeys());
      expect(after).toBe(`${USER_KEYS}\n`);
      expect(after).not.toContain('Please login');
      expect(after).not.toContain('AAAASTUBKEY');
    });

    it('у root лежал каталог с широкими правами: стягивается до 700', () => {
      mkdirSync(join(rootHome(), '.ssh'), { recursive: true, mode: 0o755 });

      run();

      expect(mode(join(rootHome(), '.ssh'))).toBe('700');
    });

    it('повторный запуск: код 0, ключи те же', () => {
      run();
      const before = read(rootKeys());

      const res = run();

      expect(res.status).toBe(0);
      expect(read(rootKeys())).toBe(before);
    });

    it.each([
      ['файла нет', null],
      ['файл пустой', ''],
      ['одни комментарии и пустые строки', '# только комментарий\n\n  \n'],
    ])(
      '%s: код 1, authorized_keys root не тронут (заглушка остаётся, пока нет замены)',
      (_name, content) => {
        const src = join(home(), '.ssh', 'authorized_keys');
        if (content === null) rmSync(src);
        else writeFileSync(src, content);
        mkdirSync(join(rootHome(), '.ssh'), { recursive: true });
        writeFileSync(rootKeys(), CLOUD_INIT_STUB);

        const res = run();

        expect(res.status).toBe(1);
        expect(res.stderr).toContain('нечего переносить');
        expect(read(rootKeys())).toBe(CLOUD_INIT_STUB);
        expect(calls('install')).toEqual([]);
      },
    );

    it('sudo без пароля недоступен: код 1 с понятным текстом, ничего не создано', () => {
      const res = run({ FAKE_NO_SUDO: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/sudo без пароля недоступен/);
      expect(existsSync(rootHome())).toBe(false);
      expect(calls('install')).toEqual([]);
    });
  });

  describe('PermitRootLogin', () => {
    it('permitrootlogin no: drop-in с prohibit-password, 644, проверка конфига, reload ssh', () => {
      const res = run({ FAKE_PERMITROOT: 'no' });

      expect(res.status).toBe(0);
      expect(read(dropin())).toBe('PermitRootLogin prohibit-password\n');
      expect(mode(dropin())).toBe('644');
      expect(calls('sshd')).toContain('sshd -t');
      expect(calls('systemctl')).toEqual(['systemctl reload ssh']);
      // reload только после проверки конфига
      const j = journal();
      expect(j.indexOf('sshd -t')).toBeLessThan(
        j.indexOf('systemctl reload ssh'),
      );
    });

    it('юнит называется sshd: reload ssh падает, следом reload sshd', () => {
      const res = run({ FAKE_PERMITROOT: 'no', FAKE_SSH_UNIT: 'sshd' });

      expect(res.status).toBe(0);
      expect(calls('systemctl')).toEqual([
        'systemctl reload ssh',
        'systemctl reload sshd',
      ]);
    });

    it.each([
      'prohibit-password',
      'without-password',
      'forced-commands-only',
      'yes',
    ])(
      'permitrootlogin %s: drop-in не создаётся, sshd не перезагружается',
      (value) => {
        const res = run({ FAKE_PERMITROOT: value });

        expect(res.status).toBe(0);
        expect(existsSync(dropin())).toBe(false);
        expect(existsSync(join(etc(), 'ssh'))).toBe(false);
        expect(calls('systemctl')).toEqual([]);
        expect(res.stdout).toContain(`permitrootlogin = ${value}`);
      },
    );

    it('конфиг с drop-in не проходит sshd -t: код 1, reload не делался', () => {
      const res = run({ FAKE_PERMITROOT: 'no', FAKE_SSHD_T_FAIL: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('reload не делался');
      expect(calls('systemctl')).toEqual([]);
    });

    it('основной конфиг задаёт no выше include: после drop-in значение прежнее, код 1', () => {
      const res = run({ FAKE_PERMITROOT: 'no', FAKE_DROPIN_IGNORED: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('по-прежнему no');
    });

    it('sshd -T ничего не вернул: код 1, drop-in не пишется', () => {
      const res = run({ FAKE_SSHD_T_EMPTY: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('sshd -T не вернул permitrootlogin');
      expect(existsSync(dropin())).toBe(false);
    });
  });

  describe('вывод и привилегии', () => {
    it('ключи и содержимое файлов не попадают ни в stdout, ни в stderr, ни в журнал вызовов', () => {
      mkdirSync(join(rootHome(), '.ssh'), { recursive: true });
      writeFileSync(rootKeys(), CLOUD_INIT_STUB);

      const res = run({ FAKE_PERMITROOT: 'no' });

      const out = [res.stdout, res.stderr, ...journal()].join('\n');
      expect(out).not.toContain('AAAAUSERKEYBODY');
      expect(out).not.toContain('AAAASTUBKEY');
      expect(out).not.toContain('ssh-ed25519');
      expect(out).not.toContain('passwordauthentication');
      expect(res.stdout).toContain('[grant-root] ключей у root: 2');
    });

    it('всё, что пишет в систему, идёт через sudo -n (без -n sudo спросил бы пароль и завис)', () => {
      run({ FAKE_PERMITROOT: 'no' });

      const j = journal();
      const privileged = j.filter((l) => !l.startsWith('sudo '));
      expect(privileged.length).toBeGreaterThan(0);
      for (const call of privileged) {
        expect(j).toContain(`sudo -n ${call}`);
      }
    });
  });
});
