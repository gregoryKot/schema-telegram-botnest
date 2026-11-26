// Список LOGIN_PROVIDERS ⇄ конструктор AuthProviderRegistry ⇄ файлы провайдеров
// (правило №4). Провайдер, добавленный в конструктор реестра, но забытый в
// списке, роняет AuthModule на старте: Nest не находит зависимость. Юниты
// контейнер не собирают, а e2e-смок ловит это только в CI — здесь контейнер
// собирается из того же списка, который раскрывает auth.module.ts.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthFlowService } from './auth-flow.service';
import { LOGIN_PROVIDERS } from './auth.login-providers';
import { OAuthCallbackService } from './oauth-callback.service';
import { AuthProviderRegistry } from './providers/registry';

const PROVIDERS_DIR = join(__dirname, 'providers');
/** id из `readonly id = '…'` каждого *.provider.ts — что лежит на диске. */
const idsOnDisk = readdirSync(PROVIDERS_DIR)
  .filter((f) => f.endsWith('.provider.ts'))
  .flatMap((f) =>
    [
      ...readFileSync(join(PROVIDERS_DIR, f), 'utf8').matchAll(
        /readonly id = '([^']+)'/g,
      ),
    ].map((m) => m[1]),
  );

describe('LOGIN_PROVIDERS — список провайдеров входа для AuthModule', () => {
  const compile = (providers: typeof LOGIN_PROVIDERS) =>
    Test.createTestingModule({
      providers: [
        ...providers,
        // Соседи по AuthModule и глобальные модули — заглушками: здесь
        // проверяется только то, что список закрывает сам себя.
        { provide: ConfigService, useValue: {} },
        { provide: AuthFlowService, useValue: {} },
        { provide: AnalyticsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

  it('контейнер собирает реестр и хвост OAuth-колбэков; в реестре — все провайдеры с диска', async () => {
    const moduleRef = await compile(LOGIN_PROVIDERS);

    const ids = moduleRef
      .get(AuthProviderRegistry)
      .list()
      .map((p) => p.id);
    expect(ids.sort()).toEqual([...idsOnDisk].sort());
    expect(ids).toContain('yandex');
    expect(moduleRef.get(OAuthCallbackService)).toBeInstanceOf(
      OAuthCallbackService,
    );
  });

  it('контроль: без одного провайдера из списка контейнер не собирается', async () => {
    const withoutLast = LOGIN_PROVIDERS.filter(
      (cls) => cls.name !== 'YandexProvider',
    );
    expect(withoutLast).toHaveLength(LOGIN_PROVIDERS.length - 1);
    await expect(compile(withoutLast)).rejects.toThrow(/YandexProvider/);
  });
});
