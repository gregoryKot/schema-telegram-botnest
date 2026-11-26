// Шов «настоящий ThrottlerGuard → тело 429» (аудит 2026-10, находка «сырой
// текст сервера на экранах входа»). До починки у throttlerOptions не было
// errorMessage, и 429 уходил телом «ThrottlerException: Too Many Requests» —
// экраны входа клали его на экран как есть. Текст рождает не тест и не мок,
// а гард с теми же опциями, что в app.module.ts, и тот же глобальный фильтр,
// что в main.ts: если UserThrottlerGuard когда-нибудь переопределит
// getErrorMessage или фильтр перепишет тело, этот спек покраснеет.
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { GenericExceptionFilter } from '../prisma/prisma-exception.filter';
import { throttlerOptions } from './throttler-module-options';
import { UserThrottlerGuard } from './throttler.guard';

@Controller('probe')
class ProbeController {
  // Без @PersistentThrottle — счётчик в памяти, Postgres не нужен; путь в
  // Postgres проверяет test/throttle-storage.e2e-spec.ts на живой базе.
  @Get('minute')
  @Throttle({ short: { limit: 1, ttl: 60_000 } })
  minute() {
    return { ok: true };
  }

  @Get('hour')
  @Throttle({ short: { limit: 1, ttl: 3_600_000 } })
  hour() {
    return { ok: true };
  }
}

describe('throttlerOptions: тело 429 от настоящего гарда', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prisma = {} as PrismaService;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: () => throttlerOptions(prisma),
        }),
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GenericExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('первый запрос проходит, второй — 429 с русским текстом и сроком в минуту', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/probe/minute')).status).toBe(200);

    const blocked = await request(server).get('/probe/minute');
    expect(blocked.status).toBe(429);
    const body = blocked.body as { statusCode: number; message: string };
    expect(body.statusCode).toBe(429);
    expect(body.message).toBe(
      'Слишком много попыток подряд. Повторить можно через минуту',
    );
    expect(body.message).not.toMatch(/Throttler|Too Many/);
  });

  it('часовое окно не обещает «через минуту»', async () => {
    const server = app.getHttpServer();
    await request(server).get('/probe/hour');
    const blocked = await request(server).get('/probe/hour');
    expect(blocked.status).toBe(429);
    expect((blocked.body as { message: string }).message).toBe(
      'Слишком много попыток подряд. Повторить можно через час',
    );
  });
});
