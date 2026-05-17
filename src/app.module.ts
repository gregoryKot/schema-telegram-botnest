import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { UserThrottlerGuard } from './api/throttler.guard';
import { TelegramModule } from './telegram/telegram.module';
import { BotModule } from './bot/bot.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { NotificationModule } from './notification/notification.module';
import { TherapyModule } from './therapy/therapy.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000,  limit: 10  },
      { name: 'long',  ttl: 60000, limit: 200 },
    ]),
    // Serve webapp/dist as static files — only when built (prod).
    // React Router needs excludePaths to let /api/* reach NestJS.
    // Telegram-only mini app at /tg (no login, uses initData)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'schema-miniapp', 'dist'),
      serveRoot: '/tg',
      serveStaticOptions: { fallthrough: true },
    }),
    // Website with login at /
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'webapp', 'dist'),
      exclude: ['/api/{*path}', '/tg/{*path}'],
      serveStaticOptions: {
        fallthrough: true, // 404 → pass to NestJS (handles /api/*)
      },
    }),
    PrismaModule,
    NotificationModule,
    AuthModule,
    TherapyModule,
    TelegramModule,
    BotModule,
    ApiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
