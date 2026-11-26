// Тесты конфигов трёх приглашений: у каждого свой вид карточки для аналитики
// и своё имя файла, а ссылка живёт в тексте сообщения (по картинке не ткнуть).
import { describe, it, expect } from 'vitest';
import {
  appInviteShare,
  pairInviteShare,
  therapistInviteShare,
} from './inviteShare';

const LINK = 't.me/SchemeHappensBot';
const INVITE_URL = 'https://schemehappens.ru/today?startapp=therapy_ABC123';
const INVITE = {
  code: 'ABC123',
  url: INVITE_URL,
  tgUrl: 'https://t.me/bot/app?startapp=therapy_ABC123',
};

describe('приглашения: конфиг карточки', () => {
  it('каждое приглашение — свой вид для аналитики и своё имя файла', () => {
    const kinds = [
      appInviteShare(LINK),
      pairInviteShare('K7-МИР', LINK),
      therapistInviteShare(INVITE),
    ];
    expect(kinds.map((k) => k.eventKind)).toEqual([
      'app_invite',
      'pair_invite',
      'therapist_invite',
    ]);
    expect(new Set(kinds.map((k) => k.filename)).size).toBe(3);
  });

  it('ссылка уходит в тексте сообщения', () => {
    expect(appInviteShare(LINK).shareText).toContain(LINK);
    expect(pairInviteShare('K7-МИР', LINK).shareText).toContain(LINK);
    expect(therapistInviteShare(INVITE).shareText).toContain(INVITE_URL);
  });

  // «Пригласить друга» зовёт на сайт: он открывается и без Telegram; бот —
  // второй строкой (FIX_PLAN 4.10; раньше в тексте был только бот).
  it('приглашение друга: сайт первой ссылкой, бот второй строкой', () => {
    const text = appInviteShare(LINK).shareText;
    const site = text.indexOf('https://schemehappens.ru');
    expect(site).toBeGreaterThan(-1);
    expect(text.indexOf(LINK)).toBeGreaterThan(site);
    expect(text.split('\n').at(-1)).toBe(`В Telegram: ${LINK}`);
  });

  it('код пары есть в тексте — его вводят вручную', () => {
    expect(pairInviteShare('K7-МИР', LINK).shareText).toContain('K7-МИР');
  });

  it('в приглашении клиенту нет ты/вы-обращения — только безличное', () => {
    const text = therapistInviteShare(INVITE).shareText;
    expect(text).not.toMatch(/\b[Тт]ы\b|\b[Вв]ы\b|[Пп]одключись|[Пп]ерейди/);
  });

  it('у каждого приглашения есть заголовок шита и отрисовка', () => {
    for (const payload of [
      appInviteShare(LINK),
      pairInviteShare('K7', LINK),
      therapistInviteShare(INVITE),
    ]) {
      expect(payload.title.length).toBeGreaterThan(0);
      expect(typeof payload.draw).toBe('function');
    }
  });
});
