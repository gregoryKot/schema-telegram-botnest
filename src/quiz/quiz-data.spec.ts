// Валидность контента мини-тестов: битый resultId, слишком длинный
// callback_data или потерянная ты/вы-вилка должны ронять jest, а не прод.
import { buildQuizzes, QUIZ_IDS, quizResultIdSet } from './quiz-registry';
import type { AddressForm } from '../notification/address-form';

const FORMS: AddressForm[] = ['ty', 'vy'];

describe('quiz-data: контент мини-тестов', () => {
  it('id тестов уникальны и callback/url-безопасны', () => {
    expect(new Set(QUIZ_IDS).size).toBe(QUIZ_IDS.length);
    for (const id of QUIZ_IDS) expect(id).toMatch(/^[a-z_]{2,16}$/);
  });

  it.each(FORMS)('форма «%s»: структура каждого теста валидна', (form) => {
    for (const quiz of buildQuizzes(form)) {
      expect(quiz.title.trim()).not.toBe('');
      expect(quiz.teaser.trim()).not.toBe('');
      // Правило онбординга: intro отвечает «что это, зачем, сколько времени».
      expect(quiz.intro.length).toBeGreaterThan(80);

      // Шаг кодируется одной цифрой в callback_data → максимум 9 вопросов.
      expect(quiz.questions.length).toBeGreaterThanOrEqual(4);
      expect(quiz.questions.length).toBeLessThanOrEqual(9);

      const resultIds = quiz.results.map((r) => r.id);
      expect(new Set(resultIds).size).toBe(resultIds.length);

      const used = new Set<string>();
      for (const q of quiz.questions) {
        expect(q.text.trim()).not.toBe('');
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        // Индекс ответа — одна цифра в callback_data.
        expect(q.options.length).toBeLessThanOrEqual(9);
        for (const o of q.options) {
          expect(o.label.trim()).not.toBe('');
          // Кнопка Telegram обрезает длинные подписи — держим читаемый предел.
          expect(o.label.length).toBeLessThanOrEqual(64);
          expect(resultIds).toContain(o.resultId);
          used.add(o.resultId);
        }
      }
      // Каждый результат достижим хотя бы одним вариантом ответа.
      for (const id of resultIds) expect(used.has(id)).toBe(true);

      for (const r of quiz.results) {
        expect(r.id).toMatch(/^[a-z_]{2,16}$/);
        expect(r.title.trim()).not.toBe('');
        expect(r.text.trim()).not.toBe('');
        expect(r.hint.trim()).not.toBe('');
      }

      // Худший callback_data укладывается в лимит Telegram (64 байта).
      const worst = `qz:q:${quiz.id}:${quiz.questions.length}:${'9'.repeat(
        quiz.questions.length,
      )}`;
      expect(Buffer.byteLength(worst, 'utf8')).toBeLessThanOrEqual(64);
    }
  });

  it('формы «ты» и «вы» различаются текстом, но не структурой', () => {
    const ty = buildQuizzes('ty');
    const vy = buildQuizzes('vy');
    ty.forEach((quizTy, i) => {
      const quizVy = vy[i];
      // Хоть одна строка развилась — вилка t() не потеряна.
      expect(JSON.stringify(quizTy)).not.toBe(JSON.stringify(quizVy));
      // Структура (вопросы/варианты/голоса) идентична.
      const shape = (q: typeof quizTy) => ({
        id: q.id,
        results: q.results.map((r) => r.id),
        votes: q.questions.map((qq) => qq.options.map((o) => o.resultId)),
      });
      expect(shape(quizTy)).toEqual(shape(quizVy));
    });
  });

  it('в «вы»-форме не осталось «ты»-обращений вне цитат «…»', () => {
    // Цитаты («…») — внутренняя речь, им можно. Всё вне кавычек — проверяем
    // grep-свипом из CLAUDE.md: ты/тебя/твой и глаголы 2 л. ед. ч.
    const stripQuotes = (s: string) => s.replace(/«[^»]*»/g, '');
    const tyPattern =
      /(^|[^а-яё])(ты|теб[еяё]|тво[йяеёию]|твоих|твоим)($|[^а-яё])|(узнаешь|увидишь|попробуй(?!те)|запомни(?!те)|напиши(?!те)|назови(?!те)|спроси(?!те)|лови(?!те)|поделись)/i;
    for (const quiz of buildQuizzes('vy')) {
      const texts = [
        quiz.title,
        quiz.teaser,
        quiz.intro,
        ...quiz.results.flatMap((r) => [r.title, r.text, r.hint]),
        ...quiz.questions.map((q) => q.text),
      ];
      for (const text of texts) {
        expect(stripQuotes(text)).not.toMatch(tyPattern);
      }
    }
  });

  it('resultId «батарейки» совпадают с needId трекера потребностей', () => {
    // Синхрон с NEED_ORDER (webapp/schema-miniapp needData.ts): результат
    // теста должен уметь вести в трекер той же потребности.
    const battery = buildQuizzes('ty').find((q) => q.id === 'battery');
    expect(battery?.results.map((r) => r.id).sort()).toEqual(
      ['attachment', 'autonomy', 'expression', 'limits', 'play'].sort(),
    );
  });

  it('quizResultIdSet отдаёт пары «тест:результат» для санитизации meta', () => {
    const set = quizResultIdSet();
    expect(set.has('drives:critic')).toBe(true);
    expect(set.has('battery:play')).toBe(true);
    expect(set.has('drives:play')).toBe(false);
    expect(set.has('нечто')).toBe(false);
  });
});
