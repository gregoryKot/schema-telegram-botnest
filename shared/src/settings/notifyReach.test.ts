import { describe, it, expect } from 'vitest';
import {
  notifyChannelHint,
  notifyChannelOf,
  notifyReachable,
  notifyUnreachableCopy,
} from './notifyReach';

const ty = (a: string) => a;
const vy = (_: string, b: string) => b;

describe('notifyReachable', () => {
  it('нет поля в ответе — не пугаем: считаем, что дойдут', () => {
    expect(notifyReachable({})).toBe(true);
    expect(notifyReachable({ notifyReachable: false })).toBe(false);
  });
});

describe('notifyChannelOf — куда уходят уведомления', () => {
  it('ответ сервера с notifyChannel — берётся как есть, включая null', () => {
    expect(
      notifyChannelOf({ notifyChannel: 'push', notifyReachable: true }),
    ).toBe('push');
    expect(
      notifyChannelOf({ notifyChannel: 'telegram', notifyReachable: true }),
    ).toBe('telegram');
    expect(
      notifyChannelOf({ notifyChannel: null, notifyReachable: false }),
    ).toBeNull();
  });

  it('старый ответ без notifyChannel — по notifyReachable: тогда был только Telegram', () => {
    expect(notifyChannelOf({ notifyReachable: true })).toBe('telegram');
    expect(notifyChannelOf({ notifyReachable: false })).toBeNull();
    expect(notifyChannelOf({})).toBe('telegram');
  });
});

describe('notifyChannelHint — подпись раздела', () => {
  it('по каналу', () => {
    expect(notifyChannelHint('push', '@bot')).toBe('Приходят в приложение');
    expect(notifyChannelHint('telegram', '@bot')).toBe(
      'Приходят через Telegram — @bot',
    );
    expect(notifyChannelHint(null, '@bot')).toBe('Пока не приходят');
  });
});

describe('notifyUnreachableCopy — блок «некуда прийти»', () => {
  it('браузер умеет пуши — два пути: это устройство или Telegram, в обеих формах', () => {
    expect(notifyUnreachableCopy(ty, true).text).toBe(
      'Чтобы напоминания приходили, включи их на этом устройстве или привяжи Telegram.',
    );
    expect(notifyUnreachableCopy(vy, true).text).toBe(
      'Чтобы напоминания приходили, включите их на этом устройстве или привяжите Telegram.',
    );
  });

  it('браузер не умеет — куда открыть сайт или Telegram, в обеих формах', () => {
    expect(notifyUnreachableCopy(ty, false).text).toMatch(
      /^Этот браузер не присылает уведомления\. Открой сайт/,
    );
    expect(notifyUnreachableCopy(vy, false).text).toMatch(
      /Откройте сайт в Chrome или Safari на телефоне — или привяжите Telegram\.$/,
    );
  });

  it('устаревшее «приходят только в Telegram» не звучит ни в одной ветке', () => {
    for (const tr of [ty, vy])
      for (const canPush of [true, false]) {
        expect(notifyUnreachableCopy(tr, canPush).text).not.toMatch(
          /только в Telegram|приходят в Telegram/,
        );
      }
    expect(notifyUnreachableCopy(ty, true).linkButton).toBe(
      'Привязать Telegram',
    );
  });
});
