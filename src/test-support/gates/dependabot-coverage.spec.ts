// Гейт «Dependabot видит все lock-файлы» (аудит 2026-10, infra#4). До него
// /shared и /game жили без записи: их зависимости не обновлял никто, а PR
// бота по остальным пакетам копились красными (15 штук). Правила —
// dependabot-coverage.ts; здесь оба исхода на образцах и прогон по настоящим
// файлам репозитория.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  lockDirectory,
  npmCoverage,
  parseUpdates,
  queueViolations,
} from './dependabot-coverage';

const ROOT = process.cwd();
const real = readFileSync(join(ROOT, '.github', 'dependabot.yml'), 'utf8');
const locks = execFileSync('git', ['ls-files', '*package-lock.json'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const npm = (dir: string, extra = '') =>
  `  - package-ecosystem: npm\n    directory: ${dir}\n    groups:\n      g-minor-patch:\n        update-types: [minor, patch]\n${extra}`;
const cfg = (...entries: string[]) =>
  `version: 2\nupdates:\n${entries.join('\n')}`;
const LOCKS = ['package-lock.json', 'shared/package-lock.json'];

describe('гейт: Dependabot видит все lock-файлы', () => {
  describe('образцы', () => {
    it('lock-файл без записи (нет /shared) краснеет как missing', () => {
      expect(npmCoverage(cfg(npm('/')), LOCKS)).toEqual({
        missing: ['/shared'],
        stale: [],
      });
    });

    it('запись без lock-файла (/foo) краснеет как stale', () => {
      const text = cfg(npm('/'), npm('/shared'), npm('/foo'));
      expect(npmCoverage(text, LOCKS)).toEqual({
        missing: [],
        stale: ['/foo'],
      });
    });

    it('полный конфиг зелёный, запись github-actions не считается каталогом npm', () => {
      const actions =
        '  - package-ecosystem: github-actions\n    directory: /\n';
      const text = cfg(npm('/'), npm('/shared'), actions);
      expect(npmCoverage(text, LOCKS)).toEqual({ missing: [], stale: [] });
    });

    it('список directories: разбирается, кавычки снимаются', () => {
      const text = cfg(
        "  - package-ecosystem: npm\n    directories:\n      - '/'\n      - /shared\n    groups:\n      g:\n        update-types: [patch]\n",
      );
      expect(parseUpdates(text)[0].directories).toEqual(['/', '/shared']);
      expect(npmCoverage(text, LOCKS)).toEqual({ missing: [], stale: [] });
    });

    it('каталог lock-файла: корневой — «/», вложенный — «/папка»', () => {
      expect(lockDirectory('package-lock.json')).toBe('/');
      expect(lockDirectory('schema-miniapp/package-lock.json')).toBe(
        '/schema-miniapp',
      );
    });

    it('npm-запись без группы, берущей patch, краснеет', () => {
      const text = cfg('  - package-ecosystem: npm\n    directory: /\n');
      expect(queueViolations(text)).toEqual([
        expect.stringContaining('нет группы, берущей patch'),
      ]);
    });

    it('мажорная группа без patterns краснеет, с patterns и причиной — нет', () => {
      const bare = npm(
        '/',
        '      all-major:\n        update-types: [major]\n',
      );
      expect(queueViolations(cfg(bare))).toEqual([
        expect.stringContaining('берёт все мажоры без patterns'),
        expect.stringContaining('нет комментария с причиной'),
      ]);
      const ok = npm(
        '/',
        "      # Nest: члены семейства не ставятся поодиночке.\n      nestjs-major:\n        patterns: ['@nestjs/*']\n        update-types: [major]\n",
      );
      expect(queueViolations(cfg(ok))).toEqual([]);
    });

    it('мажорная группа с patterns, но без причины, краснеет', () => {
      const text = npm(
        '/',
        "      nestjs-major:\n        patterns: ['@nestjs/*']\n        update-types: [major]\n",
      );
      expect(queueViolations(cfg(text))).toEqual([
        expect.stringContaining('у группы «nestjs-major» нет комментария'),
      ]);
    });

    it('ignore без причины краснеет, с причиной зелёный', () => {
      const ignore =
        "    ignore:\n      - dependency-name: '*'\n        update-types:\n          - version-update:semver-major\n";
      expect(queueViolations(cfg(npm('/', ignore)))).toEqual([
        expect.stringContaining('у ignore нет комментария'),
      ]);
      expect(
        queueViolations(cfg(npm('/', `    # Заморожено.\n${ignore}`))),
      ).toEqual([]);
    });
  });

  describe('настоящие файлы репозитория', () => {
    it('lock-файлы найдены (иначе проверка ниже ничего не доказывает)', () => {
      expect(locks).toEqual(expect.arrayContaining(['package-lock.json']));
      expect(locks.length).toBeGreaterThanOrEqual(5);
    });

    it('у каждого package-lock.json есть запись, лишних записей нет', () => {
      expect(npmCoverage(real, locks)).toEqual({ missing: [], stale: [] });
    });

    it('/shared и /game заведены явно', () => {
      const dirs = parseUpdates(real).flatMap((e) => e.directories);
      expect(dirs).toEqual(expect.arrayContaining(['/shared', '/game']));
    });

    it('есть запись github-actions, раз есть .github/workflows', () => {
      expect(existsSync(join(ROOT, '.github', 'workflows'))).toBe(true);
      expect(parseUpdates(real).map((e) => e.ecosystem)).toContain(
        'github-actions',
      );
    });

    it('очереди устроены: группы с patch, мажоры по семействам, причины', () => {
      expect(queueViolations(real)).toEqual([]);
    });

    it('семейства мажоров заведены там, где они нужны', () => {
      const groups = (dir: string) =>
        parseUpdates(real)
          .find((e) => e.directories.includes(dir))!
          .groups.map((g) => g.name);
      expect(groups('/')).toEqual(
        expect.arrayContaining(['nestjs-major', 'stryker-major']),
      );
      for (const dir of ['/webapp', '/schema-miniapp', '/shared']) {
        expect(groups(dir)).toContain('vitest-major');
      }
    });
  });
});
