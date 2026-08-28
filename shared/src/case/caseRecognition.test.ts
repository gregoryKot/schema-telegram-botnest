// Тесты экрана узнавания (шаг 8 «Разбор случая»): приметы и цепочка обязаны
// собираться из ответов самого человека, а не из контент-банков (правило
// CLAUDE.md про хардкод-заглушки — на чистых данных экран не должен
// подставлять чужой текст вместо ответа).
import { describe, it, expect } from 'vitest';
import {
  buildRecognition,
  buildDiaryPayoff,
  buildCardPayoff,
  type RecognitionCtx,
} from './caseRecognition';
import type { CaseAnswers } from './caseTypes';
import { hasTyForms } from '../utils/tyFormsSweep';
import { caseVerdict, buildVerdictReply } from './caseCriterion';

const tyTr = (ty: string, _vy: string) => ty;
const vyTr = (_ty: string, vy: string) => vy;

// JS \b не считает кириллицу «буквой» — граница слова вокруг «вы» молча не
// находится (см. shared/src/flashcard/modes.test.ts). «ты»-сторону проверяем
// готовым hasTyForms (tyFormsSweep.ts), «вы»-сторону — тем же приёмом
// lookaround, что и TY_MARKERS там же.
const NOT_CYR = '(?![а-яёА-ЯЁ])';
const NOT_CYR_BEFORE = '(?<![а-яёА-ЯЁ])';
const VY_MARKERS = new RegExp(`${NOT_CYR_BEFORE}[Вв]ы${NOT_CYR}|[Вв]ам|[Вв]аш`);

const baseAnswers = (over: Partial<CaseAnswers> = {}): CaseAnswers => ({
  scene: 'Начальник написал резким тоном в чате',
  gateId: 'shame',
  modeId: 'punitive_critic',
  bodyChipIds: ['tight_chest'],
  impulseChipIds: ['freeze'],
  criterion: { biggerThanCause: true, talkedDown: false },
  ...over,
});

const ctx = (over: Partial<RecognitionCtx> = {}): RecognitionCtx => ({
  caseCount: 0,
  tr: tyTr,
  bodyLabels: ['Тяжесть в груди'],
  impulseLabels: ['Замереть'],
  ...over,
});

describe('buildRecognition — термин «режим»', () => {
  it('первый разбор (caseCount 0) даёт дословный абзац термина', () => {
    const view = buildRecognition(baseAnswers(), ctx({ caseCount: 0 }));
    expect(view.termParagraph).toBe(
      'Полчаса назад было нормально — сейчас внутри пусто. За полчаса ' +
        'человек не меняется. Просто вперёд вышла одна часть и забрала ' +
        'управление: тело, мысли и порыв разом. Такие части называют режимами.',
    );
  });

  it('повторный разбор (caseCount > 0) термин не повторяет', () => {
    const view = buildRecognition(baseAnswers(), ctx({ caseCount: 1 }));
    expect(view.termParagraph).toBeNull();
  });
});

describe('buildRecognition — приметы из слов человека, не из банков', () => {
  it('chain и traits собраны из переданных ответов, посторонних строк нет', () => {
    const view = buildRecognition(
      baseAnswers({ scene: 'Коллега перебил на созвоне' }),
      ctx({ bodyLabels: ['Ком в горле'], impulseLabels: ['Промолчать'] }),
    );
    expect(view.chain.scene).toBe('Коллега перебил на созвоне');
    expect(view.chain.body).toBe('ком в горле');
    expect(view.chain.impulse).toBe('промолчать');
    expect(view.traits.body).toBe('ком в горле');
    expect(view.traits.impulse).toBe('промолчать');
    // никаких строк, которых не было во входных данных.
    expect(view.chain.body).not.toContain('Тяжесть в груди');
  });

  it('несколько чипов склеиваются через запятую в нижнем регистре первой буквы', () => {
    const view = buildRecognition(
      baseAnswers(),
      ctx({ bodyLabels: ['Тяжесть в груди', 'Ком в горле'] }),
    );
    expect(view.traits.body).toBe('тяжесть в груди, ком в горле');
  });

  it('bodyOwn вытесняет плейсхолдер «Своё…» среди подписей', () => {
    const view = buildRecognition(
      baseAnswers({ bodyOwn: 'дрожат руки' }),
      ctx({ bodyLabels: ['Ком в горле', 'Своё…'] }),
    );
    expect(view.traits.body).toBe('ком в горле, дрожат руки');
  });

  it('impulseOwn вытесняет плейсхолдер «Своё…» среди подписей', () => {
    const view = buildRecognition(
      baseAnswers({ impulseOwn: 'написать резкость в ответ' }),
      ctx({ impulseLabels: ['Своё…'] }),
    );
    expect(view.traits.impulse).toBe('написать резкость в ответ');
  });

  it('плейсхолдер без заполненного own даёт пустую строку, не «Своё…»', () => {
    const view = buildRecognition(
      baseAnswers({ bodyOwn: undefined }),
      ctx({ bodyLabels: ['Своё…'] }),
    );
    expect(view.traits.body).toBe('');
  });

  it('пустые чипы не роняют функцию', () => {
    expect(() =>
      buildRecognition(
        baseAnswers(),
        ctx({ bodyLabels: [], impulseLabels: [] }),
      ),
    ).not.toThrow();
    const view = buildRecognition(
      baseAnswers(),
      ctx({ bodyLabels: [], impulseLabels: [] }),
    );
    expect(view.traits.body).toBe('');
    expect(view.traits.impulse).toBe('');
  });

  it('длинная сцена обрезается по границе слова, слово не рвётся', () => {
    const longScene =
      'Начальник написал резким тоном в общем чате при всей команде и никто не заступился';
    const view = buildRecognition(baseAnswers({ scene: longScene }), ctx());
    expect(view.traits.trigger.length).toBeLessThanOrEqual(61); // 60 + «…»
    expect(view.traits.trigger.endsWith('…')).toBe(true);
    const withoutEllipsis = view.traits.trigger.slice(0, -1);
    // обрезанный хвост целиком содержится в оригинале как целые слова.
    expect(longScene.startsWith(withoutEllipsis)).toBe(true);
    expect(longScene[withoutEllipsis.length]).toBe(' ');
  });

  it('короткая сцена не обрезается вообще', () => {
    const view = buildRecognition(
      baseAnswers({ scene: 'Коллега перебил' }),
      ctx(),
    );
    expect(view.traits.trigger).toBe('Коллега перебил');
  });
});

describe('buildRecognition — clinicalName', () => {
  it('известный modeId даёт человеческую фразу режима', () => {
    const view = buildRecognition(
      baseAnswers({ modeId: 'vulnerable_child' }),
      ctx(),
    );
    expect(view.clinicalName).not.toBe('vulnerable_child');
    expect(view.clinicalName.length).toBeGreaterThan(0);
  });

  it('незнакомый modeId — фолбэк на сам modeId', () => {
    const view = buildRecognition(
      baseAnswers({ modeId: 'not_a_real_mode' }),
      ctx(),
    );
    expect(view.clinicalName).toBe('not_a_real_mode');
  });
});

describe('buildRecognition — verdictReply', () => {
  it('вердикт «mode» (несоразмерно и не отпускает) даёт соответствующий отклик', () => {
    const answers = baseAnswers({
      criterion: { biggerThanCause: true, talkedDown: false },
    });
    const view = buildRecognition(answers, ctx());
    expect(view.verdictReply).toBe(buildVerdictReply(tyTr).mode);
    expect(caseVerdict(answers.criterion)).toBe('mode');
  });

  it('вердикт «ordinary» (соразмерно и отпустило) даёт соответствующий отклик', () => {
    const answers = baseAnswers({
      criterion: { biggerThanCause: false, talkedDown: true },
    });
    const view = buildRecognition(answers, ctx());
    expect(view.verdictReply).toBe(buildVerdictReply(tyTr).ordinary);
  });

  it('null-ответ даёт «borderline», а не падает', () => {
    const answers = baseAnswers({
      criterion: { biggerThanCause: null, talkedDown: false },
    });
    const view = buildRecognition(answers, ctx());
    expect(view.verdictReply).toBe(buildVerdictReply(tyTr).borderline);
  });
});

describe('buildDiaryPayoff — форма обращения', () => {
  it('«ты»-выдача не содержит вы/вам/ваш', () => {
    const text = buildDiaryPayoff(tyTr);
    expect(text).not.toMatch(VY_MARKERS);
  });

  it('«вы»-выдача не содержит голых ты/тебя/твой', () => {
    const text = buildDiaryPayoff(vyTr);
    expect(hasTyForms(text)).toBe(false);
  });

  it('говорит про опыт (три минуты), а не только обещание', () => {
    expect(buildDiaryPayoff(tyTr)).toContain('три минуты');
  });
});

describe('buildCardPayoff — форма обращения и подстановка имени', () => {
  it('alias подставляется в обе строки', () => {
    const payoff = buildCardPayoff(tyTr, 'Стена');
    expect(payoff.headline).toContain('Стена');
    expect(payoff.detail).toContain('Стена');
  });

  it('«ты»-выдача не содержит вы/вам/ваш', () => {
    const payoff = buildCardPayoff(tyTr, 'Стена');
    expect(payoff.headline).not.toMatch(VY_MARKERS);
    expect(payoff.detail).not.toMatch(VY_MARKERS);
  });

  it('«вы»-выдача не содержит голых ты/тебя/твой', () => {
    const payoff = buildCardPayoff(vyTr, 'Стена');
    expect(hasTyForms(payoff.headline)).toBe(false);
    expect(hasTyForms(payoff.detail)).toBe(false);
  });

  it('вторая строка объясняет, что карточка встанет первой в дневнике', () => {
    const payoff = buildCardPayoff(tyTr, 'Стена');
    expect(payoff.detail).toContain('тридцати пяти');
  });
});

describe('buildCardPayoff — род имени режима', () => {
  // Имя части выбирает человек: «Стена» женского рода, «Гонщик» мужского,
  // «Пусто» среднего. Любое согласование с именем сломает две трети случаев,
  // поэтому фразы обязаны обходиться без него.
  const AGREES_WITH_NAME = /\b(её|его|первой|первым|первое|сама|сам)\b/i;

  it.each(['Стена', 'Гонщик', 'Пусто'])(
    'фраза не согласуется по роду с именем «%s»',
    (alias) => {
      const payoff = buildCardPayoff((ty) => ty, alias);
      expect(payoff.headline).not.toMatch(AGREES_WITH_NAME);
      expect(payoff.detail).not.toMatch(AGREES_WITH_NAME);
    },
  );

  it('имя человека попадает в обе строки', () => {
    const payoff = buildCardPayoff((ty) => ty, 'Гонщик');
    expect(payoff.headline).toContain('Гонщик');
    expect(payoff.detail).toContain('Гонщик');
  });
});
