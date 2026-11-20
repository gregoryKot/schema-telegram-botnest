// Новая игра «Неделя»: главы (meta.chapter) и места зова (meta.from) живут в
// своих реестрах — воронка старой игры по GAME_* их не видит. Вышли mon, wed и fri.
export const WEEK_CHAPTERS = ['mon', 'wed', 'fri', 'sun', 'first'] as const;
export type WeekChapter = (typeof WEEK_CHAPTERS)[number];
export const WEEK_CTA_PLACES = ['hook', 'final'] as const;
export type WeekCtaPlace = (typeof WEEK_CTA_PLACES)[number];

export const WEEK_CHAPTER_SET: ReadonlySet<string> = new Set(WEEK_CHAPTERS);
export const WEEK_CTA_PLACE_SET: ReadonlySet<string> = new Set(WEEK_CTA_PLACES);
