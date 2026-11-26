// Шов «бутстрап → configureApp» (src/infra/configure-app.ts) для
// src/security/hardening.invariants.spec.ts: пробное приложение через ту же
// функцию, что main.ts и e2e-сборщики, и сверка исходников этих трёх
// бутстрапов — зовут configureApp и не ставят слоёв сами.
import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Req,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { configureApp } from '../infra/configure-app';

/** Все бутстрапы HTTP-приложения: прод и оба e2e-сборщика. */
export const BOOTSTRAP_FILES = [
  'src/main.ts',
  'test/e2e-support/build-test-app.ts',
  'test/e2e-support/build-real-db-test-app.ts',
];

class EchoDto {
  @IsString()
  @MaxLength(10)
  name!: string;
}

@Controller('api/probe')
class ProbeController {
  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body;
  }

  @Get('cookie')
  cookie(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string> | undefined;
    return { sid: cookies?.sid ?? null };
  }

  @Get('ip')
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }

  @Get('boom')
  boom() {
    throw new Error('секретная внутренность: таблица User, колонка token');
  }
}

/** Пробное приложение: один контроллер, обвязка — configureApp, как в проде. */
export async function buildProbeApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

/** Слои, которые бутстрап поставил сам, мимо configureApp. */
const OWN_LAYERS = [
  /\bhelmet\s*\(/,
  /\buseGlobalFilters\s*\(/,
  /\buseGlobalPipes\s*\(/,
  /\benableCors\s*\(/,
  /\binstallBodyParsers\s*\(/,
  /\bcookieParser\s*\(/,
  /\bpermissionsPolicy\s*\(/,
  /\burlencoded\s*\(/,
  /\bapp\.use\s*\(/,
  /\bapp\.set\s*\(/,
];

export function ownLayers(src: string): string[] {
  const code = stripComments(src);
  return OWN_LAYERS.filter((re) => re.test(code)).map((re) => re.source);
}

export function callsConfigureApp(src: string): boolean {
  return /\bconfigureApp\(app\)/.test(stripComments(src));
}
