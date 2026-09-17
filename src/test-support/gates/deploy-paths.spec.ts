// Тест гейта check-deploy-paths.mjs (правило №14 CLAUDE.md — деплой-шов).
// Dockerfile/.dockerignore/amvera.yml не читает ни tsc, ни jest, ни eslint —
// рассинхрон путей между ними красил раньше только сборку на Amvera, ПОСЛЕ
// мержа. Без бейслайна — гейт жёсткий, чистое дерево обязано быть zero-tolerance.
import { runGate } from './gate-sandbox';

// Полностью согласованный набор деплой-файлов: Dockerfile копирует мини-апп
// туда же, откуда его отдаёт app.module.ts, ничего не исключено
// .dockerignore, amvera.yml называет порт, совпадающий с дефолтом
// entrypoint.mjs. Каждый red-тест портит РОВНО один файл из этого набора.
function baseline(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    Dockerfile: [
      'FROM node:22-slim AS build',
      'COPY existing.txt ./',
      'RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/',
      'CMD ["node", "deploy/entrypoint.mjs"]',
      '',
    ].join('\n'),
    'existing.txt': 'source file that really exists\n',
    'schema-miniapp/dist/index.html': '<html></html>\n',
    'src/app.module.ts': [
      "import { ServeStaticModule } from '@nestjs/serve-static';",
      "import { join } from 'path';",
      '@Module({',
      '  imports: [',
      '    ServeStaticModule.forRoot({',
      "      rootPath: join(__dirname, '..', 'webapp', 'dist'),",
      "      renderPath: '/*path',",
      '    }),',
      '  ],',
      '})',
      'export class AppModule {}',
      '',
    ].join('\n'),
    '.dockerignore': 'node_modules\ndist\n',
    'amvera.yml': [
      'meta:',
      '  environment: docker',
      '  toolchain:',
      '    name: docker',
      'run:',
      '  containerPort: 3000',
      '',
    ].join('\n'),
    'deploy/entrypoint.mjs': [
      'const PORT =',
      "  process.env.PORT !== undefined && process.env.PORT !== ''",
      '    ? Number(process.env.PORT)',
      '    : 3000;',
      '',
    ].join('\n'),
    ...overrides,
  };
}

describe('check-deploy-paths.mjs', () => {
  it('согласованный набор файлов — exit 0', () => {
    const res = runGate('check-deploy-paths.mjs', baseline());
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт деплой-путей');
  });

  describe('(a) COPY/`cp -r` источник существует в репозитории', () => {
    it('COPY копирует несуществующий путь — exit 1, называет путь', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: [
            'FROM node:22-slim AS build',
            'COPY existing.txt ./',
            'COPY missing-file.txt ./dst/',
            'RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/',
            'CMD ["node", "deploy/entrypoint.mjs"]',
            '',
          ].join('\n'),
        }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('missing-file.txt');
      expect(res.stderr).toContain('не найден в репозитории');
    });

    it('тот же COPY, но путь реально существует — exit 0', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: [
            'FROM node:22-slim AS build',
            'COPY existing.txt ./',
            'COPY missing-file.txt ./dst/',
            'RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/',
            'CMD ["node", "deploy/entrypoint.mjs"]',
            '',
          ].join('\n'),
          'missing-file.txt': 'теперь файл на месте\n',
        }),
      );
      expect(res.status).toBe(0);
    });
  });

  describe('(b) назначение мини-аппа в Dockerfile ⇄ rootPath в app.module.ts', () => {
    it('Dockerfile копирует мини-апп не туда, откуда отдаёт app.module.ts — exit 1', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: [
            'FROM node:22-slim AS build',
            'COPY existing.txt ./',
            'RUN mkdir -p webapp/dist/miniapp && cp -r schema-miniapp/dist/* webapp/dist/miniapp/',
            'CMD ["node", "deploy/entrypoint.mjs"]',
            '',
          ].join('\n'),
        }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('webapp/dist/miniapp');
      expect(res.stderr).toContain('webapp/dist/app');
    });

    it('назначение совпадает с rootPath + /app — exit 0', () => {
      const res = runGate('check-deploy-paths.mjs', baseline());
      expect(res.status).toBe(0);
    });
  });

  describe('(c) .dockerignore не исключает COPY-источник', () => {
    it('.dockerignore исключает путь, который Dockerfile тут же копирует — exit 1', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({ '.dockerignore': 'node_modules\ndist\nexisting.txt\n' }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('.dockerignore исключает «existing.txt»');
      expect(res.stderr).toContain('Dockerfile:2');
    });

    it('.dockerignore не трогает COPY-источники — exit 0', () => {
      const res = runGate('check-deploy-paths.mjs', baseline());
      expect(res.status).toBe(0);
    });
  });

  // Найдено доказательством краснения на живом дереве: правило (c) смотрело
  // только на прямые COPY из контекста и потому пропускало самый частый
  // случай. `prisma` в рантайм-образ попадает ТОЛЬКО строкой
  // `COPY --from=build /app/prisma`, прямого COPY у неё нет. Добавление
  // `prisma` в .dockerignore оставляло гейт зелёным, а сборку — сломанной:
  // из контекста путь не приезжает, значит в стадии build его нет, значит
  // копировать оттуда нечего.
  describe('(c2) .dockerignore → `COPY . .` → `COPY --from=` (транзитивно)', () => {
    const TRANSITIVE = [
      'FROM node:22-slim AS build',
      'COPY . .',
      'RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/',
      'FROM node:22-slim',
      'COPY --from=build /app/prisma ./prisma',
      'CMD ["node", "deploy/entrypoint.mjs"]',
      '',
    ].join('\n');

    it('исключённый путь копируется из стадии build — exit 1', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: TRANSITIVE,
          'prisma/schema.prisma': 'datasource db {}\n',
          '.dockerignore': 'node_modules\ndist\nprisma\n',
        }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('.dockerignore исключает «prisma»');
      expect(res.stderr).toContain('Dockerfile:5');
    });

    it('тот же Dockerfile, но путь не исключён — exit 0', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: TRANSITIVE,
          'prisma/schema.prisma': 'datasource db {}\n',
        }),
      );
      expect(res.status).toBe(0);
    });

    // Контроль: без `COPY . .` в стадию контекст не заезжает, и правило (c2)
    // молчать обязано — иначе оно краснело бы на любом мультистейдже.
    it('нет `COPY . .` — исключение из контекста не при чём, exit 0', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          Dockerfile: TRANSITIVE.replace('COPY . .', 'COPY existing.txt ./'),
          'prisma/schema.prisma': 'datasource db {}\n',
          '.dockerignore': 'node_modules\ndist\nprisma\n',
        }),
      );
      expect(res.status).toBe(0);
    });
  });

  describe('(d) amvera.yml — containerPort согласован с deploy/entrypoint.mjs', () => {
    it('containerPort расходится с портом по умолчанию в entrypoint.mjs — exit 1', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          'amvera.yml': [
            'meta:',
            '  environment: docker',
            '  toolchain:',
            '    name: docker',
            'run:',
            '  containerPort: 4000',
            '',
          ].join('\n'),
        }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('containerPort=4000');
      expect(res.stderr).toContain('3000');
    });

    it('containerPort совпадает с портом по умолчанию — exit 0', () => {
      const res = runGate('check-deploy-paths.mjs', baseline());
      expect(res.status).toBe(0);
    });
  });

  describe('(d) amvera.yml — именованный entrypoint существует', () => {
    it('amvera.yml называет несуществующий скрипт — exit 1', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          'amvera.yml': [
            'meta:',
            '  environment: docker',
            '  toolchain:',
            '    name: docker',
            'run:',
            '  containerPort: 3000',
            '  command: node deploy/nonexistent-entry.mjs',
            '',
          ].join('\n'),
        }),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('deploy/nonexistent-entry.mjs');
    });

    it('amvera.yml называет реально существующий скрипт — exit 0', () => {
      const res = runGate(
        'check-deploy-paths.mjs',
        baseline({
          'amvera.yml': [
            'meta:',
            '  environment: docker',
            '  toolchain:',
            '    name: docker',
            'run:',
            '  containerPort: 3000',
            '  command: node deploy/entrypoint.mjs',
            '',
          ].join('\n'),
        }),
      );
      expect(res.status).toBe(0);
    });
  });
});
