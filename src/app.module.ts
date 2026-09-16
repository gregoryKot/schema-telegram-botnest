import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ServerResponse } from 'http';
import { cacheControlFor } from './infra/static-cache';
import type { Request, Response } from 'express';
import { UserThrottlerGuard } from './api/throttler.guard';
import { TelegramModule } from './telegram/telegram.module';
import { BotModule } from './bot/bot.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { throttlerOptions } from './api/throttler-module-options';
import { ThrottleHitModule } from './api/throttle-hit.module';
import { CronLeaderModule } from './infra/cron-leader.module';
import { ApiModule } from './api/api.module';
import { NotificationModule } from './notification/notification.module';
import { TherapyModule } from './therapy/therapy.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { ArticlesModule } from './articles/articles.module';
import { ArticleSeoMiddleware } from './articles/article-seo.middleware';
import { practiceDomainMiddleware } from './practice-domain.middleware';
import { SiteContentModule } from './site-content/site-content.module';
import { DbOutageMonitorService } from './infra/db-outage.service';
import { SelfCheckService } from './infra/self-check/self-check.service';

// Domains that are aliases of schemehappens.ru and need their own og:url / canonical
// so Telegram generates a separate link preview card for each domain.
// kotlarewski.ru здесь не нужен: practiceDomainMiddleware 301-ит его на .gr.
const ALIAS_DOMAINS = new Set(['kotlarewski.gr']);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [PrismaService],
      useFactory: throttlerOptions,
    }),
    // Single ServeStatic: site at / (webapp/dist), mini-app at /app/. SPA
    // renderPath serves index.html for non-file paths; /api excluded.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'webapp', 'dist'),
      // path-to-regexp v6+ syntax: '/*path' (named wildcard), not bare '/*'
      renderPath: '/*path',
      exclude: ['/api/{*path}'],
      // Cache-Control по типу файла (immutable — только то, чьё имя меняется
      // вместе с содержимым; иначе max-age=0, замер 2026-08-22: 857мс).
      serveStaticOptions: {
        setHeaders: (res: ServerResponse, filePath: string) => {
          res.setHeader('Cache-Control', cacheControlFor(filePath));
        },
      },
    }),
    PrismaModule,
    ThrottleHitModule,
    CronLeaderModule,
    NotificationModule,
    AuthModule,
    TherapyModule,
    TelegramModule,
    BotModule,
    ApiModule,
    BookingModule,
    ArticlesModule,
    SiteContentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    DbOutageMonitorService,
    SelfCheckService,
  ],
})
export class AppModule implements NestModule {
  // configure() runs before ServeStaticModule.onModuleInit(), so this
  // middleware intercepts GET / before serve-static can respond.
  configure(consumer: MiddlewareConsumer) {
    const indexPath = join(__dirname, '..', 'webapp', 'dist', 'index.html');
    const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;

    // Первым: 301 kotlarewski.ru → .gr + домен-зависимые sitemap/robots
    // практики (см. practice-domain.middleware.ts).
    consumer
      .apply(practiceDomainMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.GET });

    consumer
      .apply((req: Request, res: Response, next: () => void) => {
        if (!html) return next();
        if (!ALIAS_DOMAINS.has(req.hostname)) return next();
        const domain = req.hostname;
        const modified = html
          .replace(
            'href="https://schemehappens.ru/"',
            `href="https://${domain}/"`,
          )
          .replace(
            'content="https://schemehappens.ru/"',
            `content="https://${domain}/"`,
          );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(modified);
      })
      .forRoutes({ path: '/', method: RequestMethod.GET });

    // Server-side SEO for article pages: inject real title/description/OG +
    // article text so crawlers (esp. Yandex) index them instead of an empty SPA.
    consumer
      .apply(ArticleSeoMiddleware)
      .forRoutes({ path: 'articles/*path', method: RequestMethod.GET });
  }
}
