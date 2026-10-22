// Песочница для спеков deploy/vps/bootstrap.sh (vps-bootstrap*.spec.ts):
// поддельные apt-get/curl/ufw/systemctl/docker/id/sshd/dpkg/chown в PATH, корни
// во временном каталоге (SCHEMEHAPPENS_DIR, BOOTSTRAP_ETC), журнал вызовов.
// openssl не подделан: это обёртка над настоящим, которая пишет вызов в журнал,
// — флаги генерации сертификата проверяет сам openssl.
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

const SCRIPT = join(process.cwd(), 'deploy', 'vps', 'bootstrap.sh');
const LOG = (n: string) => `echo "${n} $*" >> "$FAKE_LOG"`;

const FAKES: Record<string, string> = {
  'apt-get': `${LOG('apt-get')}
case "$*" in *docker-ce*) touch "$FAKE_STATE/docker-installed" ;; esac`,
  curl: `${LOG('curl')}
[ "\${FAKE_CURL_FAIL:-0}" = "1" ] && exit 22
while [ $# -gt 0 ]; do [ "$1" = "-o" ] && echo FAKE-GPG-KEY > "$2"; shift; done`,
  dpkg: 'echo amd64',
  id: 'echo "${FAKE_UID:-0}"',
  sshd: '[ -z "${FAKE_SSH_PORT:-}" ] || echo "port $FAKE_SSH_PORT"',
  ufw: `${LOG('ufw')}
[ "$1" != "status" ] || echo "Status: active"`,
  systemctl: LOG('systemctl'),
  chown: LOG('chown'),
  docker: `${LOG('docker')}
case "$*" in
  "compose version") [ -e "$FAKE_STATE/docker-installed" ] || exit 1 ;;
  "compose version --short") echo "\${FAKE_COMPOSE_VERSION:-2.40.0}" ;;
  "--version") echo "Docker version 27.3.1, build abc" ;;
esac`,
  openssl: `${LOG('openssl')}
exec "$FAKE_REAL_OPENSSL" "$@"`,
};

export function useBootstrapSandbox() {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vps-bootstrap-'));
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'state'));
    for (const [name, body] of Object.entries(FAKES)) {
      writeFileSync(join(dir, 'bin', name), `#!/bin/bash\n${body}\n`, {
        mode: 0o755,
      });
    }
    for (const d of ['apt/apt.conf.d', 'apt/sources.list.d', 'docker']) {
      mkdirSync(join(dir, 'etc', d), { recursive: true });
    }
    writeFileSync(
      join(dir, 'etc', 'os-release'),
      'ID=ubuntu\nVERSION_CODENAME=noble\n',
    );
    dockerInstalled(true);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const base = (f = '') => join(dir, 'srv', f);
  const etc = (f: string) => join(dir, 'etc', f);
  const read = (p: string) => readFileSync(p, 'utf8');
  const mode = (p: string) => (statSync(p).mode & 0o777).toString(8);
  const journal = () =>
    existsSync(join(dir, 'journal'))
      ? read(join(dir, 'journal')).split('\n').filter(Boolean)
      : [];
  const calls = (prefix: string) =>
    journal().filter((l) => l.startsWith(`${prefix} `));
  const dockerInstalled = (yes: boolean) => {
    const marker = join(dir, 'state', 'docker-installed');
    if (yes) writeFileSync(marker, '');
    else rmSync(marker, { force: true });
  };

  function bootstrap(env: Record<string, string> = {}) {
    return spawnSync('bash', [SCRIPT], {
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        SCHEMEHAPPENS_DIR: base(),
        BOOTSTRAP_ETC: join(dir, 'etc'),
        FAKE_LOG: join(dir, 'journal'),
        FAKE_STATE: join(dir, 'state'),
        FAKE_REAL_OPENSSL: spawnSync('which', ['openssl'], {
          encoding: 'utf8',
        }).stdout.trim(),
        ...env,
      },
      encoding: 'utf8',
      timeout: 60_000,
    });
  }
  const fresh = (env: Record<string, string> = {}) => {
    const res = bootstrap(env);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    return res;
  };

  return {
    base,
    etc,
    read,
    mode,
    journal,
    calls,
    dockerInstalled,
    bootstrap,
    fresh,
  };
}
