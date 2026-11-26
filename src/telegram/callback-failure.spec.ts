// Хелперы исхода сбоя кнопки. Строки ошибок Telegram ниже — АВТОРСКИЕ
// (записи с прода нет: логи и токен бота только у владельца); исход от разбора
// ответа не зависит, различаются только «не изменено» и всё остальное.
import {
  failCallback,
  failSettings,
  isMessageNotModified,
} from './callback-failure';
import { ERROR_RETRY } from './telegram.constants';
import { makeCtx } from './telegram.test-helpers.spec';

const NOT_MODIFIED = Object.assign(new Error('400: message is not modified'), {
  description:
    'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
});

const makeLogger = () => ({ log: jest.fn(), error: jest.fn() });

describe('isMessageNotModified', () => {
  it('узнаёт отказ по description и по тексту ошибки', () => {
    expect(isMessageNotModified(NOT_MODIFIED)).toBe(true);
    expect(
      isMessageNotModified(new Error('Bad Request: message is not modified')),
    ).toBe(true);
  });

  it('чужая 400 и обычные сбои — не «не изменено»', () => {
    const foreign = Object.assign(new Error('400'), {
      description: 'Bad Request: message to edit not found',
    });
    expect(isMessageNotModified(foreign)).toBe(false);
    expect(isMessageNotModified(new Error('db down'))).toBe(false);
    expect(isMessageNotModified(undefined)).toBe(false);
  });
});

describe('failCallback', () => {
  it('логирует ошибку и отправляет человеку новое сообщение, answerCbQuery не зовёт', async () => {
    const logger = makeLogger();
    const ctx = makeCtx();
    const err = new Error('db down');
    await failCallback(logger, ctx, 'notify:skip', err);
    expect(logger.error).toHaveBeenCalledWith('notify:skip failed', err);
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
    expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it('«message is not modified» — успех: ни сообщения, ни logger.error', async () => {
    const logger = makeLogger();
    const ctx = makeCtx();
    await failCallback(logger, ctx, 'notify:skip', NOT_MODIFIED);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('notify:skip'),
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('падение самого reply не бросает наружу', async () => {
    const ctx = makeCtx({
      reply: jest.fn().mockRejectedValue(new Error('blocked')),
    });
    await expect(
      failCallback(makeLogger(), ctx, 'x', new Error('e')),
    ).resolves.toBeUndefined();
  });
});

describe('failSettings', () => {
  it('превращает экран в ошибку с кнопкой «К настройкам» (settings:back)', async () => {
    const logger = makeLogger();
    const ctx = makeCtx();
    await failSettings(logger, ctx, 'settings:toggle', new Error('db down'));
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [text, markup] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe(ERROR_RETRY);
    expect(markup.reply_markup.inline_keyboard).toMatchObject([
      [{ text: '⬅️ К настройкам', callback_data: 'settings:back' }],
    ]);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).not.toHaveBeenCalled();
  });

  it('editMessageText отказал — запасной reply', async () => {
    const ctx = makeCtx({
      editMessageText: jest.fn().mockRejectedValue(new Error('too old')),
    });
    await failSettings(makeLogger(), ctx, 'settings:toggle', new Error('e'));
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
  });

  it('оба способа отказали — не бросает', async () => {
    const ctx = makeCtx({
      editMessageText: jest.fn().mockRejectedValue(new Error('a')),
      reply: jest.fn().mockRejectedValue(new Error('b')),
    });
    await expect(
      failSettings(makeLogger(), ctx, 'x', new Error('e')),
    ).resolves.toBeUndefined();
  });

  it('«message is not modified» — успех: экран не трогаем, error не пишем', async () => {
    const logger = makeLogger();
    const ctx = makeCtx();
    await failSettings(logger, ctx, 'settings:addr', NOT_MODIFIED);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('settings:addr'),
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
