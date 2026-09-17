// Тексты карточки: обе формы обращения и отсутствие мужского рода.
import { describe, expect, it } from 'vitest';
import { buildAccountLinkText } from './accountLinkText';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('buildAccountLinkText', () => {
  it.each(['telegram', 'site'] as const)(
    '%s: форма «ты» не содержит «вы»-обращений',
    (target) => {
      const c = buildAccountLinkText(ty, target);
      const all = [c.what, c.next, c.waiting].join(' ');
      expect(all).not.toMatch(/\b(Подключите|Нажмёте|Подтвердите|войдите)\b/);
    },
  );

  it.each(['telegram', 'site'] as const)(
    '%s: форма «вы» не содержит «ты»-обращений',
    (target) => {
      const c = buildAccountLinkText(vy, target);
      const all = [c.what, c.next, c.waiting].join(' ');
      expect(all).not.toMatch(/\b(Подключи|Нажмёшь|Подтверди|войди)\b/);
    },
  );

  it.each(['telegram', 'site'] as const)(
    '%s: объясняет и ОТКУДА это, и ЧТО будет после нажатия',
    (target) => {
      const c = buildAccountLinkText(ty, target);
      // Правило онбординга: оба ответа обязаны быть ДО первого действия.
      expect(c.what.length).toBeGreaterThan(40);
      expect(c.next.length).toBeGreaterThan(20);
      expect(c.action.length).toBeGreaterThan(0);
    },
  );

  it('в обеих формах нет прошедшего времени мужского рода', () => {
    for (const tr of [ty, vy]) {
      for (const target of ['telegram', 'site'] as const) {
        const c = buildAccountLinkText(tr, target);
        const all = [c.what, c.next, c.waiting, c.action, c.title].join(' ');
        expect(all).not.toMatch(/\b(сделал|нажал|подтвердил|вошёл|был)\b/i);
      }
    }
  });
});
