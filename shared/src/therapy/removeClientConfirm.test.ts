import { describe, it, expect } from 'vitest';
import { removeClientConfirmCopy } from './removeClientConfirm';

describe('removeClientConfirmCopy', () => {
  it('клиент с аккаунтом: данные клиента остаются, доступ закрывается', () => {
    const { title, message } = removeClientConfirmCopy({
      telegramId: 555,
      name: 'Иван',
    });
    expect(title).toBe('Удалить клиента «Иван»?');
    expect(message).toContain('удалятся насовсем');
    expect(message).toContain(
      'Заметки по сессиям, концептуализация и карты режимов',
    );
    expect(message).toContain('останутся в аккаунте клиента');
    expect(message).not.toContain('Карточка');
  });

  it('виртуальный клиент (telegramId < 0): удаляется вся карточка с заданиями', () => {
    const { message } = removeClientConfirmCopy({
      telegramId: -7,
      name: 'Иван',
    });
    expect(message).toContain('Карточка');
    expect(message).toContain(
      'заметки по сессиям, концептуализация, карты режимов и задания',
    );
    expect(message).not.toContain('останутся');
  });

  it('без имени и алиаса — заголовок без кавычек', () => {
    expect(removeClientConfirmCopy({ telegramId: 1 }).title).toBe(
      'Удалить клиента?',
    );
    expect(
      removeClientConfirmCopy({ telegramId: 1, name: null, clientAlias: null })
        .title,
    ).toBe('Удалить клиента?');
  });

  it('алиас приоритетнее имени', () => {
    expect(
      removeClientConfirmCopy({
        telegramId: 1,
        clientAlias: 'К.',
        name: 'Иван',
      }).title,
    ).toBe('Удалить клиента «К.»?');
  });

  it('старая неправда про «связь будет разорвана» не возвращается', () => {
    for (const id of [1, -1]) {
      const { message } = removeClientConfirmCopy({ telegramId: id });
      expect(message).not.toMatch(/разорван|данные сохранятся/);
    }
  });

  // Аудит 2026-10, X-1: id веб-клиента приходит строкой (> 2^53) — это
  // клиент с аккаунтом, не виртуальный.
  it('веб-клиент (id строкой > 2^53) — клиент с аккаунтом, не виртуальный', () => {
    const { message } = removeClientConfirmCopy({
      telegramId: '1000000000000000123',
    });
    expect(message).toContain('останутся в аккаунте клиента');
    expect(
      removeClientConfirmCopy({ telegramId: '-7' }).message,
    ).toContain('Карточка');
  });
});
