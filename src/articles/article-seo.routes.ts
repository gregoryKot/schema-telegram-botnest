import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ArticleSeoMiddleware } from './article-seo.middleware';
import { SitemapMiddleware } from './sitemap.middleware';

/**
 * Серверный SEO для краулеров: список и страницы статей получают настоящие
 * title/OG и текст вместо пустой оболочки SPA (Яндекс, ИИ-боты), sitemap.xml
 * строится из БД. Вызывается после practiceDomainMiddleware: алиас-хост
 * отдаёт свой sitemap и сюда не доходит.
 */
export function configureArticleSeo(consumer: MiddlewareConsumer): void {
  consumer
    .apply(ArticleSeoMiddleware)
    .forRoutes(
      { path: 'articles', method: RequestMethod.GET },
      { path: 'articles/*path', method: RequestMethod.GET },
    );
  consumer
    .apply(SitemapMiddleware)
    .forRoutes({ path: 'sitemap.xml', method: RequestMethod.GET });
}
