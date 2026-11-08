// Ответы /api/* не оседают в HTTP-кэше браузера, выход стирает кэш сайта
// (src/infra/api-no-store.ts). Через настоящий конвейер Nest + Express, как в
// main.ts: перезапись заголовка ручкой (`res.set`, `@Header`) — поведение
// чужого кода, мок повторил бы наше допущение о нём (правило №14, шов).
// Выход — настоящий AuthController: переименование ручки краснеет здесь.
import {
  Controller,
  Get,
  Header,
  type INestApplication,
  Module,
  Res,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Response } from 'express';
import request from 'supertest';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { SecurityLogService } from '../auth/security-log.service';
import { TotpService } from '../auth/totp.service';
import { StepUpService } from '../auth/step-up';
import { PrismaService } from '../prisma/prisma.service';
import { apiNoStore } from './api-no-store';

const OWN = 'public, max-age=600';

@Controller('api/probe')
class ApiProbeController {
  @Get('plain')
  plain() {
    return { ok: true };
  }

  @Get('header')
  @Header('Cache-Control', OWN)
  header() {
    return { ok: true };
  }

  @Get('res')
  res(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', OWN);
    return { ok: true };
  }
}

@Controller('page')
class PageController {
  @Get()
  page() {
    return 'page';
  }
}

@Module({
  controllers: [ApiProbeController, PageController, AuthController],
  providers: [
    { provide: AuthService, useValue: { revokeSession: jest.fn() } },
    { provide: SecurityLogService, useValue: { log: jest.fn() } },
    { provide: TotpService, useValue: {} },
    { provide: StepUpService, useValue: {} }, // StepUpGuard на link-token
    { provide: PrismaService, useValue: {} },
  ],
})
class ProbeModule {}

describe('apiNoStore: /api без HTTP-кэша, выход стирает кэш', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, {
      logger: false,
      abortOnError: false,
    });
    app.use(apiNoStore); // как в main.ts: до маршрутов Nest
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ответ /api без своего заголовка → no-store', async () => {
    const r = await http().get('/api/probe/plain').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['clear-site-data']).toBeUndefined();
  });

  it('регистр и хвостовой «/» не обходят no-store', async () => {
    const r = await http().get('/API/Probe/plain/').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it.each(['header', 'res'])(
    'ручка со своим Cache-Control (%s) сохраняет его',
    async (kind) => {
      const r = await http().get(`/api/probe/${kind}`).expect(200);
      expect(r.headers['cache-control']).toBe(OWN);
    },
  );

  it('путь вне /api не трогается', async () => {
    const r = await http().get('/page').expect(200);
    expect(r.headers['cache-control']).toBeUndefined();
  });

  it('POST /api/auth/logout (настоящий AuthController) → Clear-Site-Data: "cache"', async () => {
    const r = await http()
      .post('/api/auth/logout')
      .set('x-requested-with', 'fetch')
      .expect(200);
    expect(r.body).toEqual({ ok: true });
    expect(r.headers['clear-site-data']).toBe('"cache"');
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('контроль: другие ручки входа кэш сайта не стирают', async () => {
    const r = await http()
      .post('/api/auth/refresh')
      .set('x-requested-with', 'fetch');
    expect(r.headers['clear-site-data']).toBeUndefined();
  });
});
