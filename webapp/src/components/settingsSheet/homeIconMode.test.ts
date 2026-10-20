import { describe, it, expect } from 'vitest';
import { pickHomeIconMode } from './homeIconMode';

describe('pickHomeIconMode', () => {
  it('вкладка браузера — установка PWA', () => {
    expect(pickHomeIconMode({ hostId: 'web', canOfferInMessenger: false, standalone: false })).toBe('browser');
  });
  it('уже открыто с иконки — предлагать нечего', () => {
    expect(pickHomeIconMode({ hostId: 'web', canOfferInMessenger: false, standalone: true })).toBeNull();
  });
  it('мессенджер с addToHomeScreen — та же кнопка, что у карточки', () => {
    expect(pickHomeIconMode({ hostId: 'telegram', canOfferInMessenger: true, standalone: false })).toBe('messenger');
  });
  it('мессенджер без поддержки значка — раздела нет (PWA из webview не поставить)', () => {
    expect(pickHomeIconMode({ hostId: 'telegram', canOfferInMessenger: false, standalone: false })).toBeNull();
    expect(pickHomeIconMode({ hostId: 'max', canOfferInMessenger: false, standalone: true })).toBeNull();
  });
});
