import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { ApiController } from './api.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { ProfileService } from '../bot/profile.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { TherapyService } from '../therapy/therapy.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const USER_ID = 5n;

describe('ApiController (integration, supertest)', () => {
  let app: INestApplication;
  let bot: any, profile: any, prisma: any, auth: any, analytics: any, therapy: any;

  beforeEach(async () => {
    bot = {
      getRatings: jest.fn().mockResolvedValue({}),
      saveRating: jest.fn().mockResolvedValue(undefined),
      getProfile: jest.fn(),
      updateName: jest.fn().mockResolvedValue(undefined),
      hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
    };
    profile = { getProfile: jest.fn().mockResolvedValue({ name: 'Аня', role: 'CLIENT' }) };
    analytics = { getStreakData: jest.fn().mockResolvedValue({ currentStreak: 1 }), checkStreakTasks: jest.fn() };
    therapy = { checkStreakTasks: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ themePref: 'dark', therapistMode: true }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    auth = {
      // 'good' → валидный токен userId=5; иначе кидаем 401 (как реальный verify)
      verifyAccessToken: jest.fn((t: string) => {
        if (t === 'good') return { userId: USER_ID };
        throw new UnauthorizedException('bad token');
      }),
      buildLinkToken: jest.fn().mockReturnValue('link-token'),
    };
    const config = { get: jest.fn().mockReturnValue('bot-token') };

    const moduleRef = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [
        TelegramAuthGuard,
        { provide: BotService, useValue: bot },
        { provide: BotAnalyticsService, useValue: analytics },
        { provide: ProfileService, useValue: profile },
        { provide: NotificationService, useValue: {} },
        { provide: TelegramScheduleService, useValue: { onDiaryComplete: jest.fn().mockResolvedValue(undefined) } },
        { provide: TherapyService, useValue: therapy },
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('guard навешан на контроллер', () => {
    it('без креды → 401', async () => {
      await request(app.getHttpServer()).get('/api/profile').expect(401);
    });

    it('невалидный токен → 401', async () => {
      await request(app.getHttpServer()).get('/api/profile').set(bearer('bad')).expect(401);
    });

    it('валидный Bearer → 200, профиль запрошен по userId из токена', async () => {
      await request(app.getHttpServer()).get('/api/profile').set(bearer('good')).expect(200);
      expect(profile.getProfile).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('userId берётся из токена, не из тела', () => {
    it('POST /api/rating сохраняет под userId из токена', async () => {
      await request(app.getHttpServer())
        .post('/api/rating')
        .set(bearer('good'))
        .send({ needId: 'attachment', value: 7, userId: 999 }) // userId в теле игнорируется
        .expect(201);
      expect(bot.saveRating).toHaveBeenCalledWith(USER_ID, 'attachment', 7, undefined);
    });

    it('POST /api/rating с невалидным value → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/rating')
        .set(bearer('good'))
        .send({ needId: 'attachment', value: 11 })
        .expect(400);
      expect(bot.saveRating).not.toHaveBeenCalled();
    });
  });

  describe('анти-эскалация привилегий', () => {
    it('POST /api/user-flags НЕ записывает therapistMode (только белый список)', async () => {
      await request(app.getHttpServer())
        .post('/api/user-flags')
        .set(bearer('good'))
        .send({ therapistMode: true, themePref: 'light' })
        .expect(201);
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data).toEqual({ themePref: 'light' });
      expect(data.therapistMode).toBeUndefined();
    });
  });
});
