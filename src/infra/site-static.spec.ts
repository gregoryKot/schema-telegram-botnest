// Инцидент 2026-11-04 (перекос ассетов при выкладке): после деплоя /donate
// открылся без стилей. Amvera при выкладке шлёт запросы и в старый, и в новый
// контейнер; промах по чужому /assets/index-<хеш>.css получал SPA-фолбэк —
// index.html с 200 text/html, и с nosniff браузер молча выбрасывал стиль.
//
// Проверяется инвариант src/infra/site-static.ts: адрес файла сборки не
// отвечает HTML — есть файл → файл, нет → 404 с no-store; SPA-фолбэк страниц
// цел (контрольные образцы). Через настоящий загрузчик @nestjs/serve-static
// (express.static, renderPath, exclude) и настоящий конвейер middleware Nest,
// без моков: поломка жила в порядке и исключениях чужого кода — мок повторил
// бы наше допущение о нём, а не его поведение (правило №14, шов).
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  type DynamicModule,
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import request from 'supertest';
import { GenericExceptionFilter } from '../prisma/prisma-exception.filter';
import { configureBuildAssets, siteStaticOptions } from './site-static';

const MARKER = 'SITE-INDEX-MARKER';
const IMMUTABLE = 'public, max-age=31536000, immutable';

// Сайт как в AppModule: тот же ServeStatic и тот же вызов в configure().
@Module({})
class SiteModule implements NestModule {
  static forDist(dist: string): DynamicModule {
    return {
      module: SiteModule,
      imports: [ServeStaticModule.forRoot(siteStaticOptions(dist))],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    configureBuildAssets(consumer);
  }
}

function makeDist(): string {
  const dist = mkdtempSync(join(tmpdir(), 'site-static-'));
  const files: Record<string, string> = {
    'index.html': `<!doctype html>${MARKER}`,
    'assets/index-AbCdEf12.css': '.x{}',
    'game/index.html': '<!doctype html>GAME-INDEX',
    'game/assets/game-AbCdEf12.js': 'console.log(1)',
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, rel)), { recursive: true });
    writeFileSync(join(dist, rel), body);
  }
  return dist;
}

describe('статика сайта: адрес файла сборки — файл или 404, не HTML', () => {
  let dist: string;
  let app: INestApplication;
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    dist = makeDist();
    // NestFactory, как main.ts, а не Test.createTestingModule: тот создаёт
    // провайдеры до HTTP-адаптера, и ServeStaticModule молча берёт
    // NoopLoader — статика не отдаётся вовсе, любой путь 404.
    app = await NestFactory.create(SiteModule.forDist(dist), {
      logger: false,
      abortOnError: false,
    });
    // Как в main.ts: 404 идёт через тот же фильтр, что в проде.
    app.useGlobalFilters(new GenericExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dist, { recursive: true, force: true });
  });

  it('файл есть → 200 text/css, годовой кэш (setHeaders перезаписал no-store)', async () => {
    const res = await get('/assets/index-AbCdEf12.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
  });

  it('игра: свой файл → 200 javascript с годовым кэшем', async () => {
    const res = await get('/game/assets/game-AbCdEf12.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
  });

  // Промах — чужой хеш посреди выкладки: файл есть только у соседа.
  it.each([
    ['GET', '/assets/index-Missing9.css'],
    ['GET', '/assets/index-Missing9.css?retry=1'],
    ['HEAD', '/assets/index-Missing9.css'],
    ['GET', '/game/assets/game-Missing9.js'],
  ])(
    '%s %s нет на диске → 404 no-store, не index.html',
    async (method, url) => {
      const server = request(app.getHttpServer());
      const res = await (method === 'HEAD'
        ? server.head(url)
        : server.get(url));
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(String(res.headers['content-type'])).not.toContain('text/html');
      expect(res.text ?? '').not.toContain(MARKER);
    },
  );

  // Контрольные образцы: SPA-фолбэк страниц не задет. /assetsfoo — не под
  // /assets/: исключение обязано быть префиксом каталога, а не строки.
  it.each(['/donate', '/articles/some-slug', '/assetsfoo'])(
    '%s → index.html 200, public, no-cache',
    async (url) => {
      const res = await get(url);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('public, no-cache');
      expect(res.text).toContain(MARKER);
    },
  );

  it('/game/ — страница игры с диска, а не фолбэк сайта', async () => {
    const res = await get('/game/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('GAME-INDEX');
  });

  it('/api/nope → 404 (исключение /api на месте)', async () => {
    const res = await get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain(MARKER);
  });
});

// Исходник, а не сборка AppModule: его импорт тянет весь граф (прецедент —
// practice-domain.middleware.spec.ts), а проверяется проводка двух строк.
describe('AppModule подключает это же', () => {
  const src = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');

  it('единственный ServeStaticModule берёт siteStaticOptions', () => {
    expect(src.match(/ServeStaticModule\.forRoot\(/g)).toHaveLength(1);
    expect(src).toMatch(/ServeStaticModule\.forRoot\(\s*siteStaticOptions\(/);
  });

  it('configureBuildAssets(consumer) — после practiceDomainMiddleware', () => {
    const domain = src.indexOf('.apply(practiceDomainMiddleware)');
    expect(domain).toBeGreaterThan(-1);
    expect(src.indexOf('configureBuildAssets(consumer)')).toBeGreaterThan(
      domain,
    );
  });
});
