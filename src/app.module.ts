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
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminKeyAuditInterceptor } from './booking/admin-key-audit.interceptor';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ServerResponse } from 'http';
import { cacheControlFor } from './infra/static-cache';
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
import { configureArticleSeo } from './articles/article-seo.routes';
import {
  practiceDomainMiddleware,
  PRACTICE_ALIAS_HOSTS,
} from './practice-domain.middleware';
import { configureUnifiedFrontend } from './unified-frontend.middleware';
import { practiceIndexMiddleware } from './practice-index-html';
import { PRACTICE_INDEXED_PAGES } from './practice-domain.seo';
import { SiteContentModule } from './site-content/site-content.module';
import { DbOutageMonitorService } from './infra/db-outage.service';
import { SelfCheckService } from './infra/self-check/self-check.service';

// Domains that are aliases of schemehappens.ru and need their own og:url / canonical
// so Telegram generates a separate link preview card for each domain.
// kotlarewski.ru здесь не нужен: practiceDomainMiddleware 301-ит его на .gr.
const ALIAS_DOMAINS = PRACTICE_ALIAS_HOSTS;

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
    // Отказы по ключу админки — в аудит-лог (аудит 2026-10, I2).
    { provide: APP_INTERCEPTOR, useClass: AdminKeyAuditInterceptor },
    DbOutageMonitorService,
    SelfCheckService,
  ],
})
export class AppModule implements NestModule {
  // configure() runs before ServeStaticModule.onModuleInit(), so this
  // middleware intercepts GET of indexed practice pages before serve-static.
  configure(consumer: MiddlewareConsumer) {
    const indexPath = join(__dirname, '..', 'webapp', 'dist', 'index.html');
    const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;

    // Первым: 301 kotlarewski.ru → .gr + sitemap/robots практики. Метод ALL,
    // не GET: правило №19 («визитка отдаёт только себя») касается и записи —
    // до аудита 2026-10 POST/PUT/PATCH/DELETE на kotlarewski.gr доходили до
    // любой ручки, включая /api/auth/** (CSRF-модель рассчитана на один хост).
    consumer
      .apply(practiceDomainMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });

    configureUnifiedFrontend(consumer); // /app/* → /today за флагом
    consumer.apply(practiceIndexMiddleware(html, ALIAS_DOMAINS)).forRoutes(
      ...PRACTICE_INDEXED_PAGES.map((path) => ({
        path,
        method: RequestMethod.GET,
      })),
    );

    // SEO для /articles* и sitemap.xml — после practiceDomainMiddleware.
    configureArticleSeo(consumer);
  }
}
