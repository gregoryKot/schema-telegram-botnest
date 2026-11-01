// Обещание «кто увидит записи дневника» — правдивое в каждом состоянии
// (2026-10-26: «Никто кроме вас не увидит» висело и при подключённом
// терапевте, который видел записи).
import { describe, expect, it } from 'vitest';
import type { TherapyRelationInfo } from '../apiTypes';
import {
  diaryAccess,
  diaryPrivacyNote,
  type DiaryAccess,
} from './diaryPrivacy';

const rel = (role: 'client' | 'therapist'): TherapyRelationInfo => ({
  role,
  status: 'active',
  partnerName: 'Анна',
  partnerId: 42,
  code: 'ABC123',
  nextSession: null,
});
const ty = (t: string) => t;
const vy = (_t: string, v: string) => v;

describe('diaryAccess — по правилу сервера (therapy-client-data.service.ts)', () => {
  it('терапевта нет — записи видит только человек', () => {
    expect(diaryAccess(null, undefined)).toBe('private');
  });

  it('терапевт подключён и доступ открыт (по умолчанию) — видит', () => {
    expect(diaryAccess(rel('client'), true)).toBe('therapist-sees');
  });

  it('терапевт подключён, «Карточки схем и режимов» выключены — не видит', () => {
    expect(diaryAccess(rel('client'), false)).toBe('therapist-hidden');
  });

  it('связь или настройки не загружены — обещания нет', () => {
    expect(diaryAccess(undefined, undefined)).toBeNull();
    expect(diaryAccess(rel('client'), undefined)).toBeNull();
  });

  it('связь «я терапевт» не говорит, кто видит мой дневник — обещания нет', () => {
    expect(diaryAccess(rel('therapist'), true)).toBeNull();
  });
});

describe('diaryPrivacyNote — текст в каждом состоянии', () => {
  const cases: [DiaryAccess, string, string][] = [
    ['private', 'Никто кроме тебя не увидит', 'Никто кроме вас не увидит'],
    [
      'therapist-sees',
      'Записи видит и твой терапевт — закрыть можно в настройках, «Мой терапевт»',
      'Записи видит и ваш терапевт — закрыть можно в настройках, «Мой терапевт»',
    ],
    [
      'therapist-hidden',
      'Никто кроме тебя не увидит: терапевту доступ к записям закрыт в настройках',
      'Никто кроме вас не увидит: терапевту доступ к записям закрыт в настройках',
    ],
  ];

  it.each(cases)('%s: «ты» и «вы»', (access, tyText, vyText) => {
    expect(diaryPrivacyNote(access, ty)).toBe(tyText);
    expect(diaryPrivacyNote(access, vy)).toBe(vyText);
  });

  it('при подключённом терапевте с открытым доступом нет обещания «никто»', () => {
    expect(diaryPrivacyNote('therapist-sees', ty)).not.toMatch(/никто/i);
    expect(diaryPrivacyNote('therapist-sees', vy)).not.toMatch(/никто/i);
  });
});
