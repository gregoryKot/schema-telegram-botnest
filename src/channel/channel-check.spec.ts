// Проверка одной площадки (`/zv max`). Смысл фичи — не разбудить подписчиков
// остальных площадок ради теста свежеподключённой, и не сломать расписание:
// проверка не жжёт фразу из пула и не пишет пост в историю (иначе dueSlot
// счёл бы слот закрытым и настоящая публикация не вышла бы).
import { Logger } from '@nestjs/common';
import { ChannelCheckService } from './channel-check.service';
import type { ChannelTarget } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

function makeTarget(platform: string, destination: string | null) {
  const send = jest.fn().mockResolvedValue(undefined);
  const target: ChannelTarget = {
    platform,
    title: platform.toUpperCase(),
    envKey: `ENV_${platform.toUpperCase()}`,
    destination: () => destination,
    send,
    explain: (err) => `причина: ${(err as Error)?.message}`,
  };
  return { target, send };
}

function makePhrases(recent: string[] = ['вчерашняя фраза']) {
  const recordPost = jest.fn().mockResolvedValue(undefined);
  const pickFromPool = jest.fn().mockResolvedValue('фраза из пула');
  return {
    svc: {
      recentPostTexts: jest.fn().mockResolvedValue(recent),
      pickFromPool,
      recordPost,
    } as unknown as HealthyAdultService,
    recordPost,
    pickFromPool,
  };
}

describe('ChannelCheckService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('шлёт только на названную площадку — остальные молчат', async () => {
    const max = makeTarget('max', 'c1');
    const tg = makeTarget('telegram', '@ch');
    const { svc } = makePhrases();
    const res = await new ChannelCheckService(
      [tg.target, max.target],
      svc,
    ).checkOne('max');

    expect(max.send).toHaveBeenCalledTimes(1);
    expect(tg.send).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    expect(res.message).toContain('Проверка MAX (c1)');
  });

  it('берёт уже звучавшую фразу — пул не жжётся', async () => {
    const max = makeTarget('max', 'c1');
    const { svc, pickFromPool } = makePhrases(['вчерашняя фраза']);
    await new ChannelCheckService([max.target], svc).checkOne('max');

    expect(max.send.mock.calls[0][0].text).toBe('вчерашняя фраза');
    expect(pickFromPool).not.toHaveBeenCalled();
  });

  it('на пустой истории берёт фразу из пула — отправлять что-то надо', async () => {
    const max = makeTarget('max', 'c1');
    const { svc, pickFromPool } = makePhrases([]);
    await new ChannelCheckService([max.target], svc).checkOne('max');

    expect(pickFromPool).toHaveBeenCalledTimes(1);
    expect(max.send.mock.calls[0][0].text).toBe('фраза из пула');
  });

  it('не пишет пост в историю — иначе расписание сочтёт слот закрытым', async () => {
    const max = makeTarget('max', 'c1');
    const { svc, recordPost } = makePhrases();
    const res = await new ChannelCheckService([max.target], svc).checkOne(
      'max',
    );

    expect(recordPost).not.toHaveBeenCalled();
    // posted=false как раз и говорит расписанию: слот не тронут.
    expect(res.posted).toBe(false);
  });

  it('имя площадки можно писать как угодно регистром', async () => {
    const max = makeTarget('max', 'c1');
    const { svc } = makePhrases();
    const res = await new ChannelCheckService([max.target], svc).checkOne(
      ' MAX ',
    );
    expect(max.send).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it('незнакомое имя — список доступных, а не молчание', async () => {
    const max = makeTarget('max', 'c1');
    const vk = makeTarget('vk', 'club1');
    const { svc } = makePhrases();
    const res = await new ChannelCheckService(
      [max.target, vk.target],
      svc,
    ).checkOne('макс');

    expect(res.ok).toBe(false);
    expect(res.message).toContain('макс');
    expect(res.message).toContain('max, vk');
  });

  it('площадка без env — говорим, какую переменную задать', async () => {
    const max = makeTarget('max', null);
    const { svc } = makePhrases();
    const res = await new ChannelCheckService([max.target], svc).checkOne(
      'max',
    );

    expect(max.send).not.toHaveBeenCalled();
    expect(res.message).toContain('ENV_MAX');
  });

  it('сбой отправки объясняется причиной площадки', async () => {
    const max = makeTarget('max', 'c1');
    max.send.mockRejectedValue(new Error('нет сертификата'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, recordPost } = makePhrases();

    const res = await new ChannelCheckService([max.target], svc).checkOne(
      'max',
    );

    expect(res.ok).toBe(false);
    expect(res.message).toContain('причина: нет сертификата');
    expect(recordPost).not.toHaveBeenCalled();
  });
});
