// Журнал отправок канала «ЗВ» — механизм, которым отвечают на «почему утром
// пришло не везде» (инцидент 2026-07-31: ответить было нечем).
//
// Проверяем две вещи: исход каждой площадки доезжает до БД, и отчёт читается
// человеком — включая пустую базу, где не должно быть ни «0», ни «undefined».
import { Logger } from '@nestjs/common';
import { DeliveryLogService } from './delivery-log.service';
import { formatDeliveryLog } from './delivery-log.format';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    channelDelivery: { createMany, findMany },
  } as unknown as PrismaService;
  return { prisma, createMany, findMany };
}

const at = new Date(Date.UTC(2026, 6, 31, 7, 7)); // 10:07 МСК

describe('DeliveryLogService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('пишет строку на каждую площадку — и дошедшую, и упавшую', async () => {
    const { prisma, createMany } = makePrisma();
    await new DeliveryLogService(prisma).record(
      'утро',
      [{ platform: 'telegram', title: 'Telegram', destination: '@ch' }],
      [
        {
          platform: 'max',
          title: 'MAX',
          destination: '-77',
          reason: 'сертификат',
        },
      ],
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          source: 'утро',
          platform: 'telegram',
          destination: '@ch',
          ok: true,
        },
        {
          source: 'утро',
          platform: 'max',
          destination: '-77',
          ok: false,
          reason: 'сертификат',
        },
      ],
    });
  });

  it('многословную причину режет — одна ошибка не растянет отчёт', async () => {
    const { prisma, createMany } = makePrisma();
    await new DeliveryLogService(prisma).record(
      'вечер',
      [],
      [
        {
          platform: 'max',
          title: 'MAX',
          destination: '-77',
          reason: 'я'.repeat(500),
        },
      ],
    );
    expect(createMany.mock.calls[0][0].data[0].reason).toHaveLength(300);
  });

  it('нечего писать — в БД не ходим', async () => {
    const { prisma, createMany } = makePrisma();
    await expect(
      new DeliveryLogService(prisma).record('утро', [], []),
    ).resolves.toBeUndefined();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('упавшая запись журнала не роняет публикацию — пост уже вышел', async () => {
    const { prisma, createMany } = makePrisma();
    createMany.mockRejectedValue(new Error('db down'));
    const errors = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      new DeliveryLogService(prisma).record(
        'утро',
        [{ platform: 'vk', title: 'ВКонтакте', destination: 'club1' }],
        [],
      ),
    ).resolves.toBeUndefined();
    expect(String(errors.mock.calls[0][0])).toContain('db down');
  });

  it('отдаёт последние отправки, новые сверху', async () => {
    const { prisma, findMany } = makePrisma();
    await new DeliveryLogService(prisma).recent(5);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { id: 'desc' }, take: 5 });
  });
});

describe('formatDeliveryLog', () => {
  it('на пустой базе говорит словами, а не показывает пустоту', () => {
    expect(formatDeliveryLog([])).toContain('Журнал пуст');
  });

  it('показывает время по Москве, слот, площадку и исход', () => {
    const text = formatDeliveryLog([
      {
        source: 'утро',
        platform: 'telegram',
        destination: '@ch',
        ok: true,
        reason: null,
        createdAt: at,
      },
    ]);
    expect(text).toContain('31.07 10:07');
    expect(text).toContain('утро');
    expect(text).toContain('telegram');
    expect(text).toContain('дошло');
  });

  it('у неудачи видна причина, а не только слово «не дошло»', () => {
    const text = formatDeliveryLog([
      {
        source: 'проверка',
        platform: 'max',
        destination: '-77',
        ok: false,
        reason: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY\nПроверь сертификат',
        createdAt: at,
      },
    ]);
    expect(text).toContain('не дошло — UNABLE_TO_GET_ISSUER_CERT_LOCALLY');
    // Вторая строка причины в отчёт не лезет: список должен читаться глазами.
    expect(text).not.toContain('Проверь сертификат');
  });

  it('запись без причины не превращается в «undefined»', () => {
    const text = formatDeliveryLog([
      {
        source: 'вечер',
        platform: 'vk',
        destination: 'club1',
        ok: false,
        reason: null,
        createdAt: at,
      },
    ]);
    expect(text).toContain('причина не записана');
    expect(text).not.toContain('undefined');
  });
});
