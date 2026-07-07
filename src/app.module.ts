import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { UserThrottlerGuard } from './api/throttler.guard';
import { TelegramModule } from './telegram/telegram.module';
import { BotModule } from './bot/bot.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { NotificationModule } from './notification/notification.module';
import { TherapyModule } from './therapy/therapy.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { ArticlesModule } from './articles/articles.module';
import { SiteContentModule } from './site-content/site-content.module';

// Domains that are aliases of schemehappens.ru and need their own og:url / canonical
// so Telegram generates a separate link preview card for each domain.
const ALIAS_DOMAINS = new Set(['kotlarewski.ru', 'kotlarewski.gr']);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000,  limit: 10  },
      { name: 'long',  ttl: 60000, limit: 200 },
    ]),
    // Single ServeStatic for everything.
    // webapp/dist serves the website at /
    // webapp/dist/app/ contains the Telegram mini app (schema-miniapp build)
    // renderPath: '/*' makes it SPA-friendly — serves index.html for all
    // non-file paths so HTML5 history routing (/diary, /schemas, etc.) works.
    // API routes are excluded so /api/* still hits NestJS handlers.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'webapp', 'dist'),
      // path-to-regexp v6+ syntax: '/*path' (named wildcard), not bare '/*'
      renderPath: '/*path',
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
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
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule implements NestModule {
  // configure() runs before ServeStaticModule.onModuleInit(), so this
  // middleware intercepts GET / before serve-static can respond.
  configure(consumer: MiddlewareConsumer) {
    const indexPath = join(__dirname, '..', 'webapp', 'dist', 'index.html');
    const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;

    consumer
      .apply((req: any, res: any, next: () => void) => {
        if (!html) return next();
        if (!ALIAS_DOMAINS.has(req.hostname)) return next();
        const domain = req.hostname;
        const modified = html
          .replace('href="https://schemehappens.ru/"', `href="https://${domain}/"`)
          .replace('content="https://schemehappens.ru/"', `content="https://${domain}/"`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(modified);
      })
      .forRoutes({ path: '/', method: RequestMethod.GET });
  }
}
