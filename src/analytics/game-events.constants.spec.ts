// Санитайзер меты игры (game-events.constants.ts). Игра не авторизует
// пользователя вообще, поэтому каждая ветка проверяется на «известное поле
// проходит» и на контрольный случай «незнакомое значение не ломает счётчик
// молча, а обнуляет/сворачивается по чёткому правилу» — только src игры
// снисходителен (сворачивает в 'other'), остальные поля дропают событие
// целиком.
import {
  GAME_CHAPTERS,
  GAME_CTA_PLACES,
  GAME_ENTRY_SOURCES,
  GAME_EVENTS,
  isGameEvent,
  sanitizeGameMeta,
  type GameEventName,
} from './game-events.constants';

describe('isGameEvent', () => {
  it('true для каждого имени из GAME_EVENTS', () => {
    for (const name of GAME_EVENTS) expect(isGameEvent(name)).toBe(true);
  });

  it('false для чужого/незнакомого имени', () => {
    expect(isGameEvent('share_card')).toBe(false);
    expect(isGameEvent('game_unknown')).toBe(false);
    expect(isGameEvent('')).toBe(false);
  });
});

describe('sanitizeGameMeta: game_open', () => {
  it('пропускает известный src', () => {
    for (const src of GAME_ENTRY_SOURCES) {
      expect(sanitizeGameMeta('game_open', { src })).toEqual({ src });
    }
  });

  it('незнакомый src сворачивается в other, событие не теряется', () => {
    expect(sanitizeGameMeta('game_open', { src: 'вконтакте' })).toEqual({
      src: 'other',
    });
  });

  it('без meta и с мусорным типом src — тоже other (факт открытия важнее метки)', () => {
    expect(sanitizeGameMeta('game_open', undefined)).toEqual({ src: 'other' });
    expect(sanitizeGameMeta('game_open', {})).toEqual({ src: 'other' });
    expect(sanitizeGameMeta('game_open', { src: 42 })).toEqual({
      src: 'other',
    });
  });
});

describe('sanitizeGameMeta: события с meta.chapter', () => {
  const withChapter: GameEventName[] = [
    'game_chapter_start',
    'game_chapter_done',
    'game_over',
  ];

  it.each(withChapter)('%s: пропускает известную главу', (name) => {
    for (const chapter of GAME_CHAPTERS) {
      expect(sanitizeGameMeta(name, { chapter })).toEqual({ chapter });
    }
  });

  it.each(withChapter)(
    '%s: незнакомая глава дропает событие (null, не мусор в отчёте)',
    (name) => {
      expect(sanitizeGameMeta(name, { chapter: 'chapter9' })).toBeNull();
      expect(sanitizeGameMeta(name, { chapter: 5 })).toBeNull();
      expect(sanitizeGameMeta(name, {})).toBeNull();
      expect(sanitizeGameMeta(name, undefined)).toBeNull();
    },
  );

  it('PII/лишние поля рядом с валидной главой не проходят', () => {
    const out = sanitizeGameMeta('game_chapter_done', {
      chapter: 'chapter2',
      userId: 7,
      note: 'моя личная заметка',
    });
    expect(out).toEqual({ chapter: 'chapter2' });
  });
});

describe('sanitizeGameMeta: события с meta.from', () => {
  const withFrom: GameEventName[] = [
    'game_cta_shown',
    'game_cta_click',
    'game_share',
  ];

  it.each(withFrom)('%s: пропускает известное место', (name) => {
    for (const from of GAME_CTA_PLACES) {
      expect(sanitizeGameMeta(name, { from })).toEqual({ from });
    }
  });

  it.each(withFrom)('%s: незнакомое место дропает событие', (name) => {
    expect(sanitizeGameMeta(name, { from: 'menu' })).toBeNull();
    expect(sanitizeGameMeta(name, {})).toBeNull();
    expect(sanitizeGameMeta(name, undefined)).toBeNull();
  });
});

describe('sanitizeGameMeta: события без meta', () => {
  const withoutMeta: GameEventName[] = [
    'game_start',
    'game_tutorial_done',
    'game_tutorial_skip',
  ];

  it.each(withoutMeta)(
    '%s: всегда {} — любые присланные поля отбрасываются',
    (name) => {
      expect(sanitizeGameMeta(name, undefined)).toEqual({});
      expect(sanitizeGameMeta(name, { anything: 'x', userId: 1 })).toEqual({});
    },
  );
});
