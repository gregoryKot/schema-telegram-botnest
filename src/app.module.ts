import {
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  SERVE_STATIC_MODULE_OPTIONS,
  ServeStaticModule,
  type ServeStaticModuleOptions,
} from '@nestjs/serve-static';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminKeyAuditInterceptor } from './booking/admin-key-audit.interceptor';
import { PricingService } from './booking/pricing.service';
import { join } from 'path';
import { configureBuildAssets, siteStaticFactory } from './infra/site-static';
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
import { practiceDomainMiddleware } from './practice-domain.middleware';
import { configureUnifiedFrontend } from './unified-frontend.middleware';
import { configureSitePages } from './site-pages.routes';
import { SiteContentModule } from './site-content/site-content.module';
import { DbOutageMonitorService } from './infra/db-outage.service';
import { SelfCheckService } from './infra/self-check/self-check.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [PrismaService],
      useFactory: throttlerOptions,
    }),
    // Сайт на / (webapp/dist): фолбэк, исключения и кэш — infra/site-static.ts;
    // index.html фолбэка — с ценой визитки из админки.
    ServeStaticModule.forRootAsync({
      imports: [BookingModule],
      inject: [PricingService],
      useFactory: siteStaticFactory(join(__dirname, '..', 'webapp', 'dist')),
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
  constructor(
    @Inject(SERVE_STATIC_MODULE_OPTIONS)
    private readonly site: ServeStaticModuleOptions[],
    private readonly pricing: PricingService,
  ) {}

  // configure() runs before ServeStaticModule.onModuleInit(), so this
  // middleware intercepts GET of practice pages before serve-static.
  configure(consumer: MiddlewareConsumer) {
    // Первым: 301 kotlarewski.ru → .gr + sitemap/robots практики. Метод ALL,
    // не GET: правило №19 («визитка отдаёт только себя») касается и записи —
    // до аудита 2026-10 POST/PUT/PATCH/DELETE на kotlarewski.gr доходили до
    // любой ручки, включая /api/auth/** (CSRF-модель рассчитана на один хост).
    consumer
      .apply(practiceDomainMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });

    configureUnifiedFrontend(consumer); // /app/* → /today за флагом
    configureBuildAssets(consumer); // промах по файлу сборки — 404 no-store
    // Страницы визитки, главная для робота, llms.txt — с ценой из админки;
    // корень — тот же, что у ServeStatic (в e2e — сборка-фикстура).
    configureSitePages(consumer, this.site[0]?.rootPath, (text) =>
      this.pricing.landingText(text),
    );

    // SEO для /articles* и sitemap.xml — после practiceDomainMiddleware.
    configureArticleSeo(consumer);
  }
}
