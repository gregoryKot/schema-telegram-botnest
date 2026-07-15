import {
  HEALTHY_ADULT_PHRASES,
  HEALTHY_ADULT_SLOTS_PER_DAY,
  healthyAdultIndex,
  pickHealthyAdultPhrase,
} from './healthy-adult.data';

describe('healthy-adult phrase selection', () => {
  it('пул непустой и без пустых/дублирующихся строк', () => {
    expect(HEALTHY_ADULT_PHRASES.length).toBeGreaterThan(0);
    expect(HEALTHY_ADULT_PHRASES.every((p) => p.trim().length > 0)).toBe(true);
    expect(new Set(HEALTHY_ADULT_PHRASES).size).toBe(
      HEALTHY_ADULT_PHRASES.length,
    );
  });

  it('фразы form-agnostic: без «ты/вы»-обращений (broadcast, не привязан к addressForm)', () => {
    // Второе лицо к читателю недопустимо: подписчик с формой «вы» не должен
    // увидеть «ты» и наоборот. Токенизируем по unicode-буквам (JS \w/\b — ASCII,
    // на кириллице не работают) и сверяем со списком местоимений + окончаний 2 л.
    const forbiddenWords = new Set([
      'ты',
      'тебя',
      'тебе',
      'тобой',
      'твой',
      'твоя',
      'твоё',
      'твоего',
      'твои',
      'вы',
      'вас',
      'вам',
      'вами',
      'ваш',
      'ваша',
      'ваше',
      'ваши',
      'вашего',
    ]);
    const secondPersonEnding = /(ешь|аешь|ишь|ете|йте)$/;
    const offenders = HEALTHY_ADULT_PHRASES.filter((p) =>
      p
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .filter(Boolean)
        .some((w) => forbiddenWords.has(w) || secondPersonEnding.test(w)),
    );
    expect(offenders).toEqual([]);
  });

  it('индекс всегда в границах пула', () => {
    for (let day = -5; day < 5; day++) {
      for (let slot = 0; slot < HEALTHY_ADULT_SLOTS_PER_DAY; slot++) {
        const i = healthyAdultIndex(day, slot, HEALTHY_ADULT_PHRASES.length);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(HEALTHY_ADULT_PHRASES.length);
      }
    }
  });

  it('обходит весь пул без повторов за один цикл', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const seen: string[] = [];
    // Полный цикл = pool.length постов = pool.length/SLOTS дней.
    const posts = pool.length;
    for (let n = 0; n < posts; n++) {
      const day = Math.floor(n / HEALTHY_ADULT_SLOTS_PER_DAY);
      const slot = n % HEALTHY_ADULT_SLOTS_PER_DAY;
      seen.push(pool[healthyAdultIndex(day, slot, pool.length)]);
    }
    expect(new Set(seen).size).toBe(pool.length);
  });

  it('детерминирована: одна дата+слот → одна фраза', () => {
    const date = new Date('2026-07-15T06:00:00Z');
    expect(pickHealthyAdultPhrase(date, 0)).toBe(
      pickHealthyAdultPhrase(new Date('2026-07-15T23:00:00Z'), 0),
    );
    expect(pickHealthyAdultPhrase(date, 0)).not.toBe(
      pickHealthyAdultPhrase(date, 1),
    );
  });
});
