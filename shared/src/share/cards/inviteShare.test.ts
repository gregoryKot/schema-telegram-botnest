// Тесты конфигов трёх приглашений: у каждого свой вид карточки для аналитики
// и своё имя файла, а ссылка живёт в тексте сообщения (по картинке не ткнуть).
import { describe, it, expect } from 'vitest';
import {
  appInviteShare,
  pairInviteShare,
  therapistInviteShare,
} from './inviteShare';

const LINK = 't.me/SchemeHappensBot';
const INVITE_URL = 'https://schemehappens.ru/i/abc123';

describe('приглашения: конфиг карточки', () => {
  it('каждое приглашение — свой вид для аналитики и своё имя файла', () => {
    const kinds = [
      appInviteShare(LINK),
      pairInviteShare('K7-МИР', LINK),
      therapistInviteShare(INVITE_URL),
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
    expect(therapistInviteShare(INVITE_URL).shareText).toContain(INVITE_URL);
  });

  it('код пары есть в тексте — его вводят вручную', () => {
    expect(pairInviteShare('K7-МИР', LINK).shareText).toContain('K7-МИР');
  });

  it('в приглашении клиенту нет ты/вы-обращения — только безличное', () => {
    const text = therapistInviteShare(INVITE_URL).shareText;
    expect(text).not.toMatch(/\b[Тт]ы\b|\b[Вв]ы\b|[Пп]одключись|[Пп]ерейди/);
  });

  it('у каждого приглашения есть заголовок шита и отрисовка', () => {
    for (const payload of [
      appInviteShare(LINK),
      pairInviteShare('K7', LINK),
      therapistInviteShare(INVITE_URL),
    ]) {
      expect(payload.title.length).toBeGreaterThan(0);
      expect(typeof payload.draw).toBe('function');
    }
  });
});
