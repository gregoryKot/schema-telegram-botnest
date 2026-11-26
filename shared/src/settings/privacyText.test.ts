// Регресс: webapp и miniapp формулировали доверительное заявление про
// непередачу данных по-разному — доверительное заявление обязано звучать
// дословно одинаково независимо от аккаунт-лейбла (В10 аудита 2026-08).
import { describe, it, expect } from 'vitest';
import { privacyStorageText, PRIVACY_NO_SHARE_TEXT } from './privacyText';

describe('PRIVACY_NO_SHARE_TEXT', () => {
  it('называет получателей явно — рекламные сети и третьи лица', () => {
    expect(PRIVACY_NO_SHARE_TEXT).toContain('рекламным сетям');
    expect(PRIVACY_NO_SHARE_TEXT).toContain('третьим лицам');
    expect(PRIVACY_NO_SHARE_TEXT).toContain('Никогда');
  });
});

describe('privacyStorageText', () => {
  it('платформенный лейбл — параметр, остальной текст неизменен', () => {
    const webText = privacyStorageText('аккаунту');
    const tgText = privacyStorageText('Telegram-аккаунту');
    expect(webText).toContain('привязано к аккаунту');
    expect(tgText).toContain('привязано к Telegram-аккаунту');
    // Всё, кроме лейбла, совпадает дословно.
    expect(webText.replace('аккаунту', '')).toBe(
      tgText.replace('Telegram-аккаунту', ''),
    );
  });
});
