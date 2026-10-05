import { describe, expect, it } from 'vitest';
import {
  CONTACT_CHANNELS,
  contactChannelLabel,
  contactPlaceholder,
  isContactChannel,
  telegramNumberHint,
} from './contactChannel';

describe('contactChannel', () => {
  it('три канала в порядке показа', () => {
    expect([...CONTACT_CHANNELS]).toEqual(['telegram', 'whatsapp', 'email']);
  });

  it('подписи', () => {
    expect(contactChannelLabel('telegram')).toBe('Telegram');
    expect(contactChannelLabel('whatsapp')).toBe('WhatsApp');
    expect(contactChannelLabel('email')).toBe('Почта');
  });

  it('подсказки в поле ввода', () => {
    expect(contactPlaceholder('telegram')).toBe('@username или номер телефона');
    expect(contactPlaceholder('whatsapp')).toBe('Номер с кодом страны');
    expect(contactPlaceholder('email')).toBe('Адрес почты');
  });

  it('isContactChannel: известные значения проходят, остальное нет', () => {
    for (const ch of CONTACT_CHANNELS) expect(isContactChannel(ch)).toBe(true);
    for (const bad of ['sms', '', 'Telegram', null, undefined, 1, {}]) {
      expect(isContactChannel(bad)).toBe(false);
    }
  });

  describe('telegramNumberHint', () => {
    it('номер в Telegram — подсказка про @username', () => {
      expect(telegramNumberHint('telegram', '+79990001122')).toMatch(
        /@username/,
      );
      expect(
        telegramNumberHint('telegram', '+7 (999) 000-11-22'),
      ).not.toBeNull();
    });
    it('@username — без подсказки', () => {
      expect(telegramNumberHint('telegram', '@anya')).toBeNull();
      expect(telegramNumberHint('telegram', '@anya_1234567')).toBeNull();
    });
    it('номер в WhatsApp и почте — без подсказки', () => {
      expect(telegramNumberHint('whatsapp', '+79990001122')).toBeNull();
      expect(telegramNumberHint('email', '79990001122')).toBeNull();
    });
    it('короткий ввод — без подсказки', () => {
      expect(telegramNumberHint('telegram', '+7999')).toBeNull();
      expect(telegramNumberHint('telegram', '')).toBeNull();
    });
  });
});
