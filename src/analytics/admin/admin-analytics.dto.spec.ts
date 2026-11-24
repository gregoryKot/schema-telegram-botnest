import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminAnalyticsQueryDto,
  DEFAULT_ADMIN_DAYS,
} from './admin-analytics.dto';

const check = (plain: object) =>
  validate(plainToInstance(AdminAnalyticsQueryDto, plain));

describe('AdminAnalyticsQueryDto', () => {
  it('строка "7" из query приводится к числу и валидна', async () => {
    const dto = plainToInstance(AdminAnalyticsQueryDto, { days: '7' });
    expect(dto.days).toBe(7);
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([5, 'abc', 365])('days=%p отвергается', async (days) => {
    expect(await check({ days })).not.toHaveLength(0);
  });

  it('пустой объект валиден, дефолт — 30', async () => {
    expect(await check({})).toHaveLength(0);
    expect(DEFAULT_ADMIN_DAYS).toBe(30);
  });
});
