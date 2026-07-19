// Поведенческие тесты админ-эндпоинтов «Здорового Взрослого»: гейтинг по
// x-admin-key (ADMIN_BOOKING_KEY, не ADMIN_ID — это HTTP-админка, не бот),
// и что каждый метод дёргает правильный сервис с правильными аргументами.
import { ForbiddenException } from '@nestjs/common';
import { HealthyAdultAdminController } from './healthy-adult-admin.controller';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { TelegramChannelService } from './telegram.channel.service';

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
  } as unknown as HealthyAdultService;
}

function makeChannel() {
  return {
    post: jest.fn().mockResolvedValue({ ok: true, message: 'posted' }),
  } as unknown as TelegramChannelService;
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
    expect(channel.post).not.toHaveBeenCalled();
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

  it('testPost с валидным ключом публикует в канал (channel.post)', async () => {
    const { controller, channel } = makeController();
    const res = await controller.testPost(ADMIN_KEY);
    expect(channel.post).toHaveBeenCalledTimes(1);
    expect(res).toEqual(expect.objectContaining({ ok: true }));
  });
});
