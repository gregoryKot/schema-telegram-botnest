// Логика deploy/vps/bootstrap.sh, часть 2: версия Compose, установка Docker,
// предусловия (root, Ubuntu). Подделки и песочница —
// src/test-support/vps-bootstrap-sandbox.ts. Версию Compose проверяет настоящий `sort -V`
// скрипта на строке из поддельного `docker compose version --short`.
// Не покрыто: что download.docker.com отдаёт настоящий ключ и что apt ставит
// настоящие пакеты — подделка curl пишет в файл заглушку.
import { existsSync, rmSync, writeFileSync } from 'fs';
import { useBootstrapSandbox } from '../test-support/vps-bootstrap-sandbox';

describe('deploy/vps/bootstrap.sh: Compose, Docker, предусловия', () => {
  const {
    base,
    etc,
    read,
    mode,
    journal,
    calls,
    dockerInstalled,
    bootstrap,
    fresh,
  } = useBootstrapSandbox();

  describe('версия Compose (нужна 2.30+: env_file format: raw)', () => {
    it.each(['2.30.0', '2.31.1', 'v2.40.0', '3.0.0'])(
      '%s подходит, скрипт идёт дальше',
      (v) => {
        const res = fresh({ FAKE_COMPOSE_VERSION: v });

        expect(res.stdout).toContain(`Compose ${v.replace(/^v/, '')}`);
        expect(calls('ufw').length).toBeGreaterThan(0);
      },
    );

    it.each(['2.29.7', '2.9.0', '1.29.2'])(
      '%s слишком старая: код 1 до фаервола и до создания пароля',
      (v) => {
        const res = bootstrap({ FAKE_COMPOSE_VERSION: v });

        expect(res.status).toBe(1);
        expect(res.stderr).toContain(`Compose ${v} старше 2.30`);
        expect(calls('ufw')).toEqual([]);
        expect(existsSync(base())).toBe(false);
      },
    );
  });

  describe('установка Docker', () => {
    it('Docker уже есть: репозиторий не подключается, daemon.json владельца не трогается', () => {
      writeFileSync(etc('docker/daemon.json'), '{"owner":true}');

      const res = fresh();

      expect(calls('curl')).toEqual([]);
      expect(existsSync(etc('apt/sources.list.d/docker.list'))).toBe(false);
      expect(read(etc('docker/daemon.json'))).toBe('{"owner":true}');
      expect(calls('systemctl')).toEqual(['systemctl enable --now docker']);
      expect(res.stdout).toContain('Docker 27.3.1, Compose 2.40.0');
    });

    it('Docker нет: ключ и репозиторий подключены, пакеты и compose-плагин поставлены, зеркало записано', () => {
      dockerInstalled(false);

      fresh();

      expect(calls('curl')[0]).toMatch(
        /^curl -fsSL --retry 3 https:\/\/download\.docker\.com\/linux\/ubuntu\/gpg -o .*docker\.asc$/,
      );
      expect(mode(etc('apt/keyrings/docker.asc'))).toBe('644');
      expect(read(etc('apt/sources.list.d/docker.list'))).toBe(
        `deb [arch=amd64 signed-by=${etc('apt/keyrings/docker.asc')}] ` +
          'https://download.docker.com/linux/ubuntu noble stable\n',
      );
      expect(
        calls('apt-get').some(
          (l) =>
            l.includes('docker-ce ') && l.includes('docker-compose-plugin'),
        ),
      ).toBe(true);
      expect(read(etc('docker/daemon.json'))).toContain('mirror.gcr.io');
      expect(calls('systemctl')).toContain('systemctl restart docker');
    });

    it('download.docker.com недоступен: код 1 с объяснением, пакеты Docker не ставятся', () => {
      dockerInstalled(false);

      const res = bootstrap({ FAKE_CURL_FAIL: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('download.docker.com недоступен');
      expect(calls('apt-get').some((l) => l.includes('docker-ce'))).toBe(false);
      expect(calls('ufw')).toEqual([]);
    });
  });

  describe('предусловия', () => {
    it('базовые пакеты и автообновления безопасности', () => {
      fresh();

      const install = calls('apt-get').find((l) => l.includes('install'));
      expect(install).toMatch(/ufw .*unattended-upgrades/);
      expect(read(etc('apt/apt.conf.d/20auto-upgrades'))).toContain(
        'APT::Periodic::Unattended-Upgrade "1";',
      );
    });

    it('не root: код 1 и ни одного вызова apt/ufw', () => {
      const res = bootstrap({ FAKE_UID: '1000' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('нужен root');
      expect(journal()).toEqual([]);
    });

    it.each([
      ['Debian', 'ID=debian\nVERSION_CODENAME=bookworm\n'],
      ['файла os-release нет', null],
    ])('не Ubuntu (%s): код 1 до установки пакетов', (_name, osRelease) => {
      if (osRelease === null) rmSync(etc('os-release'));
      else writeFileSync(etc('os-release'), osRelease);

      const res = bootstrap();

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('рассчитано на Ubuntu');
      expect(journal()).toEqual([]);
    });
  });
});
