// Тексты связи клиент↔терапевт (инцидент 2026-10-26): обе формы обращения,
// нейтральный род («Анна Терапевт подключён» был мужским при любом имени),
// имя терапевта — только настоящее.
import { describe, it, expect } from 'vitest';
import {
  INVITE_CODE_HINT,
  inviteFromLine,
  inviteInvalidText,
  joinDoneText,
  leaveTherapyCopy,
  therapistConnectedTitle,
} from './therapistLinkCopy';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('therapistConnectedTitle', () => {
  it('с именем — «Терапевт: имя», без рода', () => {
    expect(therapistConnectedTitle('Анна Терапевт')).toBe(
      'Терапевт: Анна Терапевт',
    );
  });

  it('без имени — нейтральная строка, имя не выдумывается', () => {
    const t = therapistConnectedTitle(null);
    expect(t).not.toMatch(/подключён|подключен\b/);
    expect(t).toBe('Подключение к терапевту активно');
  });
});

describe('joinDoneText', () => {
  it('называет терапевта и что он видит; обе формы', () => {
    expect(joinDoneText('Анна', ty)).toMatch(
      /^Терапевт Анна видит твой трекер потребностей и задания/,
    );
    expect(joinDoneText('Анна', vy)).toMatch(
      /^Терапевт Анна видит ваш трекер потребностей и задания/,
    );
    expect(joinDoneText('Анна', vy)).toMatch(/откроете/);
  });

  it('без имени — просто «Терапевт»', () => {
    expect(joinDoneText(null, ty)).toMatch(/^Терапевт видит/);
  });

  it('без маркеров рода («сам», «сама»)', () => {
    for (const tr of [ty, vy])
      expect(joinDoneText('Анна', tr)).not.toMatch(/\bсама?\b/);
  });
});

describe('экран согласия', () => {
  it('строка «от кого» и текст про недействующую ссылку в обеих формах', () => {
    expect(inviteFromLine('Анна')).toBe('Приглашение от терапевта: Анна');
    expect(inviteInvalidText(ty)).toMatch(/Попроси у терапевта новую/);
    expect(inviteInvalidText(vy)).toMatch(/Попросите у терапевта новую/);
  });
});

describe('leaveTherapyCopy', () => {
  it('объясняет последствие и путь назад; ошибка в обеих формах', () => {
    const c = leaveTherapyCopy(ty);
    expect(c.title).toBe('Отключиться от терапевта?');
    expect(c.message).toMatch(/твой трекер/);
    expect(c.message).toMatch(/по новому коду/);
    expect(leaveTherapyCopy(vy).message).toMatch(/ваш трекер/);
    expect(leaveTherapyCopy(vy).error).toMatch(/Проверьте связь/);
  });
});

describe('INVITE_CODE_HINT', () => {
  it('называет реальный путь в приложении', () => {
    expect(INVITE_CODE_HINT).toMatch(/Профиль → Настройки → «Мой терапевт»/);
    expect(INVITE_CODE_HINT).toMatch(/вкладка «Я»/);
  });
});
