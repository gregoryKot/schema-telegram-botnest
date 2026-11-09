// Статика сайта в e2e — как в src/main.ts (docs/open/ci-tests.md, «e2e не отдаёт
// статику вовсе»). Test.createTestingModule создаёт провайдер загрузчика
// ServeStaticModule до HTTP-адаптера: фабрика видит пустой HttpAdapterHost и
// берёт NoopLoader, и ни один e2e не видел ни SPA-фолбэка, ни раздачи
// webapp/dist — любой путь вне контроллеров отвечал 404. Здесь загрузчик —
// ExpressLoader (его получает main.ts через NestFactory), а корень статики —
// маленькая сборка-фикстура test/fixtures/site-dist: настоящего webapp/dist в
// джобе backend нет. Живой стенд передаёт свой корень (настоящую сборку).
import { join } from 'path';
import {
  AbstractLoader,
  ExpressLoader,
  SERVE_STATIC_MODULE_OPTIONS,
} from '@nestjs/serve-static';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { siteStaticOptions } from '../../src/infra/site-static';

export const E2E_SITE_DIST = join(__dirname, '..', 'fixtures', 'site-dist');

export function withSiteStatic(
  builder: TestingModuleBuilder,
  siteDist: string = E2E_SITE_DIST,
): TestingModuleBuilder {
  return builder
    .overrideProvider(AbstractLoader)
    .useValue(new ExpressLoader())
    .overrideProvider(SERVE_STATIC_MODULE_OPTIONS)
    .useValue([siteStaticOptions(siteDist)]);
}
