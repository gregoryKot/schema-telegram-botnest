// Тексты связи клиент↔терапевт (инцидент 2026-10-26): обе формы обращения,
// нейтральный род («Анна Терапевт подключён» был мужским при любом имени),
// имя терапевта — только настоящее.
import { describe, it, expect } from 'vitest';
import {
  INVITE_CODE_HINT,
  inviteFromLine,
  inviteInvalidText,
  joinDoneText,
  therapistSectionHint,
  leaveTherapyCopy,
  SHARE_CARDS_TOGGLE,
  SHARE_PROFILE_TOGGLE,
  taskSheetTitle,
  therapistConnectedTitle,
  therapistNameLine,
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

// QA 2026-11: «Задание для Ольга», «с Анна Терапевт» — имя после предлога
// требует падежа, а склонять его нечем. Формула без падежа: «роль: имя» или «·».
describe('имя без падежа', () => {
  it('«Терапевт: имя» — одна формула для статуса и баннера встречи', () => {
    expect(therapistNameLine('Анна Терапевт')).toBe('Терапевт: Анна Терапевт');
    expect(therapistConnectedTitle('Анна')).toBe(therapistNameLine('Анна'));
  });

  it('заголовок листа задания: с клиентом — «Задание · имя», без — «Новое задание»', () => {
    expect(taskSheetTitle('Ольга')).toBe('Задание · Ольга');
    expect(taskSheetTitle(undefined)).toBe('Новое задание');
    expect(taskSheetTitle(null)).toBe('Новое задание');
    expect(taskSheetTitle('Ольга')).not.toMatch(/(^|\s)(для|с|у|от)\s+Ольга/);
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
  });

  // QA 2026-11: текст обещал «только то, что откроешь», а оба тумблера по
  // умолчанию включены (`?? true`, src/api/settings.controller.ts).
  it('говорит правду о значении по умолчанию и где закрыть', () => {
    for (const tr of [ty, vy]) {
      const t = joinDoneText('Анна', tr);
      expect(t).toMatch(/по умолчанию ещё дневники/);
      expect(t).toMatch(/Закрыть их можно в настройках, раздел «Мой терапевт»/);
      expect(t).not.toMatch(/только то, что откро/);
    }
  });

  // QA 2026-11, М7: в самом разделе «Мой терапевт» — не «в настройках».
  it('в настройках — «тумблерами ниже», а не «в настройках»', () => {
    for (const tr of [ty, vy]) {
      const t = joinDoneText('Анна', tr, true);
      expect(t).toMatch(/тумблерами ниже/);
      expect(t).not.toMatch(/в настройках/);
    }
  });

  it('без имени — просто «Терапевт»', () => {
    expect(joinDoneText(null, ty)).toMatch(/^Терапевт видит/);
  });

  it('без маркеров рода («сам», «сама»)', () => {
    for (const tr of [ty, vy])
      expect(joinDoneText('Анна', tr)).not.toMatch(/\bсама?\b/);
  });
});

// Названия тумблеров — ровно то, что закрывает сервер
// (src/therapy/therapy-client-data.service.ts): therapistShareCards гасит
// дневники и карточки, therapistShareProfile — «Мои схемы/режимы» и тест.
describe('тумблеры «Мой терапевт»', () => {
  it('тумблер дневников называет дневники', () => {
    expect(SHARE_CARDS_TOGGLE.title).toMatch(/^Дневники/);
    expect(SHARE_CARDS_TOGGLE.sub).toMatch(/дневник/);
    expect(SHARE_CARDS_TOGGLE.sub).toMatch(/карточки схем и режимов/);
  });

  it('тумблер профиля не обещает спрятать имя: называет схемы и тест', () => {
    expect(SHARE_PROFILE_TOGGLE.title).not.toMatch(/Профиль/);
    expect(SHARE_PROFILE_TOGGLE.sub).toMatch(/схем и режимов.*теста/);
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

// QA 2026-11, М7: «Остальное — на твоё усмотрение» спорило с «открыто по
// умолчанию» ниже.
describe('therapistSectionHint', () => {
  it('говорит, что открыто по умолчанию и где закрыть', () => {
    expect(therapistSectionHint(true)).toMatch(/по умолчанию.*тумблерами ниже/);
    expect(therapistSectionHint(false)).toMatch(/после подключения/);
    expect(therapistSectionHint(true)).not.toMatch(/усмотрение/);
  });
});
