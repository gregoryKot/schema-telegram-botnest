// Логика deploy/vps/bootstrap.sh (первичная настройка чистого VPS), часть 1:
// фаервол, пароль БД, TLS Postgres, HOLD_APP. Подделки и песочница —
// src/test-support/vps-bootstrap-sandbox.ts. Что настоящий ufw закроет порт, а apt поставит
// пакет, здесь не проверяется (это делает первый живой запуск op=bootstrap);
// проверяется то, что скрипт решает САМ: какие порты открыть (и что 5432 не
// открывать никогда), не перезаписать ли пароль БД и TLS-ключ при повторном
// запуске, когда ставить HOLD_APP.
// Не покрыто (нужен root и настоящий сервер): chown 999:999 (в журнале видно
// только вызов), действие apt/ufw/systemctl, права файлов в настоящем /etc.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { useBootstrapSandbox } from '../test-support/vps-bootstrap-sandbox';

describe('deploy/vps/bootstrap.sh: фаервол, секреты, HOLD_APP', () => {
  const { base, read, mode, journal, calls, fresh } = useBootstrapSandbox();

  describe('фаервол', () => {
    it('открыты 22/80/443, default deny, enable после правил; 5432 нигде в вызовах нет', () => {
      fresh();

      const ufw = calls('ufw');
      expect(ufw).toEqual(
        expect.arrayContaining([
          'ufw default deny incoming',
          'ufw default allow outgoing',
          'ufw limit 22/tcp',
          'ufw allow 80/tcp',
          'ufw allow 443',
        ]),
      );
      const enable = ufw.indexOf('ufw --force enable');
      expect(enable).toBeGreaterThan(ufw.indexOf('ufw allow 443'));
      expect(enable).toBeGreaterThan(ufw.indexOf('ufw limit 22/tcp'));
      expect(journal().filter((l) => l.includes('5432'))).toEqual([]);
    });

    it('sshd на другом порту: он тоже открыт (иначе enable отрезал бы владельца от сервера)', () => {
      fresh({ FAKE_SSH_PORT: '2222' });

      expect(calls('ufw')).toEqual(
        expect.arrayContaining(['ufw limit 22/tcp', 'ufw limit 2222/tcp']),
      );
    });
  });

  describe('пароль БД и TLS', () => {
    it('db.env создан с правами 600 и 48 hex; пароль не печатается; ключ 600, сертификат 644', () => {
      const res = fresh();

      const env = read(base('db.env'));
      expect(env).toMatch(/^POSTGRES_PASSWORD=[0-9a-f]{48}\n$/);
      expect(mode(base('db.env'))).toBe('600');
      const password = env.split('=')[1].trim();
      expect(res.stdout + res.stderr).not.toContain(password);
      expect(journal().join('\n')).not.toContain(password);
      expect(mode(base('pg-tls/server.key'))).toBe('600');
      expect(mode(base('pg-tls/server.crt'))).toBe('644');
      expect(read(base('pg-tls/server.crt'))).toContain('BEGIN CERTIFICATE');
      expect(calls('chown')).toEqual([
        `chown 999:999 ${base('pg-tls/server.key')} ${base('pg-tls/server.crt')}`,
      ]);
    });

    it('повторный запуск: пароль и сертификат те же, openssl генерирует по разу', () => {
      fresh();
      const before = ['db.env', 'pg-tls/server.key', 'pg-tls/server.crt'].map(
        (f) => read(base(f)),
      );

      fresh();

      const after = ['db.env', 'pg-tls/server.key', 'pg-tls/server.crt'].map(
        (f) => read(base(f)),
      );
      expect(after).toEqual(before);
      expect(calls('openssl').filter((l) => l.includes(' req '))).toHaveLength(
        1,
      );
      expect(
        calls('openssl').filter((l) => l.startsWith('openssl rand')),
      ).toHaveLength(1);
    });

    it('чужой db.env не перезаписывается, но права стягиваются до 600', () => {
      mkdirSync(base(), { recursive: true });
      writeFileSync(base('db.env'), 'POSTGRES_PASSWORD=owner-pw\n', {
        mode: 0o644,
      });

      fresh();

      expect(read(base('db.env'))).toBe('POSTGRES_PASSWORD=owner-pw\n');
      expect(mode(base('db.env'))).toBe('600');
      expect(calls('openssl').some((l) => l.includes('rand'))).toBe(false);
    });

    it('пустой db.env считается отсутствующим: пароль создаётся', () => {
      mkdirSync(base(), { recursive: true });
      writeFileSync(base('db.env'), '');

      fresh();

      expect(read(base('db.env'))).toMatch(/^POSTGRES_PASSWORD=[0-9a-f]{48}\n/);
    });

    it('есть ключ, нет сертификата: пара генерируется заново целиком', () => {
      fresh();
      rmSync(base('pg-tls/server.crt'));
      const oldKey = read(base('pg-tls/server.key'));

      fresh();

      expect(read(base('pg-tls/server.key'))).not.toBe(oldKey);
      expect(existsSync(base('pg-tls/server.crt'))).toBe(true);
      expect(calls('openssl').filter((l) => l.includes(' req '))).toHaveLength(
        2,
      );
    });
  });

  describe('HOLD_APP', () => {
    it('свежий сервер (релиза нет): ставится и об этом сказано в логе', () => {
      const res = fresh();

      expect(existsSync(base('HOLD_APP'))).toBe(true);
      expect(res.stdout).toContain('HOLD_APP поставлен');
    });

    it('повторный запуск до release-hold: флаг остаётся', () => {
      fresh();
      fresh();

      expect(existsSync(base('HOLD_APP'))).toBe(true);
    });

    it('сервер уже работает (release записан), флага нет: приложение не останавливается', () => {
      mkdirSync(base(), { recursive: true });
      writeFileSync(base('release'), 'a'.repeat(40));

      const res = fresh();

      expect(existsSync(base('HOLD_APP'))).toBe(false);
      expect(res.stdout).not.toContain('HOLD_APP');
    });

    it('пустой файл release не считается релизом: флаг ставится', () => {
      mkdirSync(base(), { recursive: true });
      writeFileSync(base('release'), '');

      fresh();

      expect(existsSync(base('HOLD_APP'))).toBe(true);
    });
  });
});
