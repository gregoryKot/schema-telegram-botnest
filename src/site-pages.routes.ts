// Страницы и файлы сайта, которые сервер отдаёт сам, раньше ServeStatic, —
// каждая с ценой визитки из админки (booking/landing-price.ts). Корень сборки
// тот же, что у ServeStatic: в e2e это сборка-фикстура, а не webapp/dist.
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { LandingText } from './booking/landing-price';
import { homeSeoMiddleware } from './articles/home-seo.middleware';
import { quizSeoMiddleware } from './quiz/quiz-seo.middleware';
import { PRICE_FILE_ROUTES, priceFilesMiddleware } from './infra/price-files';
import { PRACTICE_ALIAS_HOSTS } from './practice-domain.middleware';
import {
  PRACTICE_PREVIEW_ROUTES,
  practiceIndexMiddleware,
} from './practice-index-html';

/** После practiceDomainMiddleware и configureBuildAssets, до ServeStatic. */
export function configureSitePages(
  consumer: MiddlewareConsumer,
  root: string | undefined,
  landingText: LandingText,
): void {
  const read = (file: string): string | null => {
    const path = root ? join(root, file) : null;
    return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
  };
  const html = read('index.html');

  // Страницы визитки на алиасе — свои карточка ссылки и canonical, иначе
  // Telegram и поисковик склеивают визитку с продуктом.
  consumer
    .apply(practiceIndexMiddleware(html, PRACTICE_ALIAS_HOSTS, landingText))
    .forRoutes(...PRACTICE_PREVIEW_ROUTES);
  // Главная продукта: текст лендинга в #root для робота без JS (GEO.md);
  // после practiceIndexMiddleware — главная визитки до сюда не доходит.
  consumer
    .apply(homeSeoMiddleware(html, landingText))
    .forRoutes({ path: '/', method: RequestMethod.GET });
  // Мини-тесты: title/description/OG и текст теста для поисковика.
  consumer
    .apply(quizSeoMiddleware(html, landingText))
    .forRoutes(
      { path: 'tests', method: RequestMethod.GET },
      { path: 'tests/*path', method: RequestMethod.GET },
    );
  const files = { '/llms.txt': read('llms.txt'), '/index.html': html };
  consumer
    .apply(priceFilesMiddleware(files, landingText))
    .forRoutes(...PRICE_FILE_ROUTES);
}
