// Пятая слепая зона check-gendered-forms (docs/open/frontend-ux.md, аудит
// 2026-10): гейт ждал «ты» ПЕРЕД глаголом из своего списка, и мимо шли глагол
// раньше местоимения («вход начинал не ты»), отрицание при опущенном
// подлежащем («не знал, чего ждать»), «сам» без «ты» («Справлялся сам») и
// краткие прилагательные вне списка («ты благодарен»). Расширения живут в
// существующих правилах; здесь — образец и контрольный образец на каждое.
// Остальные пины паттернов — gendered-forms.spec.ts.
import { loadNamedPatterns } from './pattern-loader';

const PATTERNS = loadNamedPatterns('gendered-forms-patterns.mjs', 'PATTERNS');
const hits = (name: string, text: string) => {
  const p = PATTERNS.find((x) => x.name === name)!;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
};

describe('check-gendered-forms — глагол перед «ты»', () => {
  it.each([
    'Не совпадает или вход начинал не ты',
    'Принимал ли ты сегодня решение?',
    'Сделал же ты это',
  ])('ловит: %s', (text) => expect(hits('ty-past', text)).toBe(true));

  it.each([
    'вход начинала не ты',
    'вход начинали не вы',
    'Вход начал кто-то другой',
  ])('контроль, не ловит: %s', (text) =>
    expect(hits('ty-past', text)).toBe(false),
  );
});

describe('check-gendered-forms — краткие прилагательные «ты»-ветки', () => {
  it.each([
    'ты благодарен себе',
    'ты нужен',
    'ты не одинок',
    'ты счастлив',
    'ты недостаточно хорош',
  ])('ловит: %s', (text) => expect(hits('ty-short-adj', text)).toBe(true));

  it.each([
    'ты благодарна себе',
    'ты нужна',
    'тыквенный счастливчик',
    'ты недостаточно хороша',
  ])('контроль, не ловит: %s', (text) =>
    expect(hits('ty-short-adj', text)).toBe(false),
  );
});

describe('check-gendered-forms — опущенное подлежащее: отрицание и «сам»', () => {
  it.each([
    'признаются: «не знал, чего ждать»',
    'Ничего не выразил сегодня.',
    'Тяжело. Справлялся сам.',
  ])('ловит: %s', (text) =>
    expect(hits('dropped-subject-past', text)).toBe(true),
  );

  it.each([
    'Отец не знал, чего ждать',
    'Пока никто не записывался сам.',
    'Поллинг завершился сам',
    'Страх. Прошёл сам по себе.',
    '«не знала, чего ждать»',
  ])('контроль, не ловит: %s', (text) =>
    expect(hits('dropped-subject-past', text)).toBe(false),
  );
});

describe('check-gendered-forms — «я (недостаточно) хорош» в реплике читателя', () => {
  it.each([
    'убеждение «я недостаточно хорош»',
    'фраза «я хорош таким, какой есть»',
  ])('ловит: %s', (text) => expect(hits('ya-short-adj', text)).toBe(true));

  it.each([
    '«я недостаточно хороша»',
    '«со мной что-то не так»',
    'я хорошо справляюсь',
  ])('контроль, не ловит: %s', (text) =>
    expect(hits('ya-short-adj', text)).toBe(false),
  );
});
