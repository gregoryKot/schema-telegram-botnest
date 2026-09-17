// Поведенческие тесты админ-эндпоинтов «Здорового Взрослого»: гейтинг по
// x-admin-key (ADMIN_BOOKING_KEY, не ADMIN_ID — это HTTP-админка, не бот),
// и что каждый метод дёргает правильный сервис с правильными аргументами.
import { ForbiddenException } from '@nestjs/common';
import { HealthyAdultAdminController } from './healthy-adult-admin.controller';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { ChannelPublisherService } from '../channel/channel-publisher.service';

const ADMIN_KEY = 'test-admin-key-1234';

function makeConfig(key: string | undefined = ADMIN_KEY) {
  return { get: jest.fn(() => key) } as any;
}

function makePhrases() {
  return {
    list: jest
      .fn()
      .mockResolvedValue([{ id: 1, text: 'x', enabled: true, sortOrder: 0 }]),
    create: jest
      .fn()
      .mockResolvedValue({ id: 2, text: 'new', enabled: true, sortOrder: 1 }),
    update: jest
      .fn()
      .mockResolvedValue({ id: 1, text: 'upd', enabled: false, sortOrder: 0 }),
    remove: jest.fn().mockResolvedValue({ ok: true }),
    importMany: jest.fn().mockResolvedValue({
      created: 2,
      report: { accepted: ['фраза1', 'фраза2'], rejected: [] },
    }),
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 5, unused: 3, daysLeft: 1 }),
  } as unknown as HealthyAdultService;
}

function makeChannel() {
  return {
    publish: jest.fn().mockResolvedValue({ ok: true, message: 'posted' }),
  } as unknown as ChannelPublisherService;
}

function makeController(
  opts: { key?: string; phrases?: any; channel?: any } = {},
) {
  const phrases = opts.phrases ?? makePhrases();
  const channel = opts.channel ?? makeChannel();
  const controller = new HealthyAdultAdminController(
    phrases,
    channel,
    makeConfig(opts.key),
  );
  return { controller, phrases, channel };
}

describe('HealthyAdultAdminController — гейтинг по x-admin-key', () => {
  it('верный ключ пропускает запрос', async () => {
    const { controller, phrases } = makeController();
    await expect(controller.list(ADMIN_KEY)).resolves.toBeDefined();
    expect(phrases.list).toHaveBeenCalled();
  });

  it('неверный ключ — ForbiddenException, сервис не вызывается', async () => {
    const { controller, phrases } = makeController();
    await expect(controller.list('wrong-key')).rejects.toThrow(
      ForbiddenException,
    );
    expect(phrases.list).not.toHaveBeenCalled();
  });

  it('отсутствующий ключ (undefined) — ForbiddenException', async () => {
    const { controller, phrases } = makeController();
    await expect(controller.list(undefined as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(phrases.list).not.toHaveBeenCalled();
  });

  it('ADMIN_BOOKING_KEY не задан на сервере (пусто) — эндпоинт закрыт даже пустым ключом от клиента', async () => {
    const { controller, phrases } = makeController({ key: '' });
    await expect(controller.list('')).rejects.toThrow(ForbiddenException);
    expect(phrases.list).not.toHaveBeenCalled();
  });

  it('гейтинг применяется ко всем методам (create/update/remove/test-post), не только list', async () => {
    const { controller, phrases, channel } = makeController();
    await expect(controller.create({ text: 'x' }, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.update(1, { text: 'y' }, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.remove(1, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.testPost('wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(phrases.create).not.toHaveBeenCalled();
    expect(phrases.update).not.toHaveBeenCalled();
    expect(phrases.remove).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });
});

describe('HealthyAdultAdminController — действия делегируют в сервисы', () => {
  it('create передаёт текст из DTO', async () => {
    const { controller, phrases } = makeController();
    const res = await controller.create({ text: 'новая фраза' }, ADMIN_KEY);
    expect(phrases.create).toHaveBeenCalledWith('новая фраза');
    expect(res).toEqual(expect.objectContaining({ id: 2, text: 'new' }));
  });

  it('update передаёт id (через ParseIntPipe в реальном рантайме) и патч', async () => {
    const { controller, phrases } = makeController();
    await controller.update(1, { enabled: false }, ADMIN_KEY);
    expect(phrases.update).toHaveBeenCalledWith(1, { enabled: false });
  });

  it('remove передаёт id', async () => {
    const { controller, phrases } = makeController();
    const res = await controller.remove(1, ADMIN_KEY);
    expect(phrases.remove).toHaveBeenCalledWith(1);
    expect(res).toEqual({ ok: true });
  });

  it('testPost с валидным ключом публикует по площадкам (publisher.publish)', async () => {
    const { controller, channel } = makeController();
    const res = await controller.testPost(ADMIN_KEY);
    expect(channel.publish).toHaveBeenCalledTimes(1);
    expect(res).toEqual(expect.objectContaining({ ok: true }));
  });

  it('import передаёт текст в importMany и форматирует отчёт', async () => {
    const { controller, phrases } = makeController();
    const res = await controller.import({ text: 'фраза1\nфраза2' }, ADMIN_KEY);
    expect(phrases.importMany).toHaveBeenCalledWith('фраза1\nфраза2');
    expect(res).toEqual(
      expect.objectContaining({
        created: 2,
        message: expect.any(String),
      }),
    );
  });

  it('import с неверным ключом — ForbiddenException, importMany не вызывается', async () => {
    const { controller, phrases } = makeController();
    await expect(controller.import({ text: 'x' }, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(phrases.importMany).not.toHaveBeenCalled();
  });

  it('poolStatus с валидным ключом возвращает остаток пула из сервиса', async () => {
    const { controller } = makeController();
    const res = await controller.poolStatus(ADMIN_KEY);
    expect(res).toEqual({ enabled: 5, unused: 3, daysLeft: 1 });
  });

  it('poolStatus с неверным ключом — ForbiddenException, сервис не вызывается', async () => {
    const { controller, phrases } = makeController();
    await expect(controller.poolStatus('wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(phrases.poolStatus).not.toHaveBeenCalled();
  });
});
