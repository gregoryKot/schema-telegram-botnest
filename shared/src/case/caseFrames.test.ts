// Покрываем: hasOwnDetail — гейт кнопки «Дальше» шага сцены (пустая сцена,
// рамка без правок, рамка + своя деталь, отредактированная рамка — правки
// самой рамки не должны ошибочно засчитываться за деталь, если длина не
// выросла); CASE_FRAMES дословно; buildFrameHint/buildScenePlaceholder —
// смоук и проверка, что «вы»-выдача не содержит «ты»-текста и наоборот.
import { describe, it, expect } from 'vitest';
import {
  CASE_FRAMES,
  buildFrameHint,
  buildScenePlaceholder,
  hasOwnDetail,
} from './caseFrames';
import type { Tr } from './caseTypes';

const tyTr: Tr = (ty) => ty;
const vyTr: Tr = (_ty, vy) => vy;

const TY_LEAK =
  /(?<![А-Яа-яЁё])(?:[Тт]ы|[Тт]еб[еяё]|[Тт]во[а-яё]*)(?![А-Яа-яЁё])/;
const VY_LEAK =
  /(?<![А-Яа-яЁё])(?:[Вв]ы|[Вв]ас|[Вв]ам|[Вв]аш[а-яё]*)(?![А-Яа-яЁё])/;

describe('CASE_FRAMES', () => {
  it('ровно четыре рамки, дословно', () => {
    expect(CASE_FRAMES).toEqual([
      'Сообщение прочитано час назад. Ответа нет.',
      'На созвоне смеются над чем-то своим. Шутка мимо меня.',
      'Договорились встретиться — отменили за час.',
      'Прислали правки: «переделай». Сижу над текстом до ночи.',
    ]);
  });
});

describe('buildFrameHint', () => {
  it('ты-вариант не содержит "вы"-обращения', () => {
    const text = buildFrameHint(tyTr);
    expect(VY_LEAK.test(text)).toBe(false);
    expect(TY_LEAK.test(text)).toBe(true);
  });

  it('вы-вариант не содержит "ты"-обращения и согласован во множественном числе', () => {
    const text = buildFrameHint(vyTr);
    expect(TY_LEAK.test(text)).toBe(false);
    expect(VY_LEAK.test(text)).toBe(true);
    expect(text).toBe('Рамка. Допишите, что было конкретно у вас: кто, когда.');
  });
});

describe('buildScenePlaceholder', () => {
  it('непустой, нейтральный (ни "ты", ни "вы")', () => {
    const text = buildScenePlaceholder(tyTr);
    expect(text.length).toBeGreaterThan(0);
    expect(TY_LEAK.test(text)).toBe(false);
    expect(VY_LEAK.test(text)).toBe(false);
  });
});

describe('hasOwnDetail', () => {
  const frame = CASE_FRAMES[0]; // 'Сообщение прочитано час назад. Ответа нет.'

  it('пустая сцена — детали нет', () => {
    expect(hasOwnDetail('', frame)).toBe(false);
  });

  it('только рамка, без единой правки — детали нет', () => {
    expect(hasOwnDetail(frame, frame)).toBe(false);
  });

  it('рамка + своя деталь — деталь есть', () => {
    const scene = `${frame} Ждал ответа весь вечер, потом написал ещё раз.`;
    expect(hasOwnDetail(scene, frame)).toBe(true);
  });

  it('отредактированная рамка без заметного прироста длины — детали нет', () => {
    // Точечная правка формулировки (не дописывание) не меняет длину почти
    // совсем — substring-проверка тут бы сразу сломалась (рамки как
    // подстроки уже нет), а сравнение по длине по-прежнему честно отвечает.
    const edited = 'Сообщение прочитано час назад. Ответа так и нет.';
    expect(edited.includes(frame)).toBe(false); // подстрока действительно пропала
    expect(hasOwnDetail(edited, frame)).toBe(false);
  });

  it('отредактированная и заметно расширенная рамка — деталь есть', () => {
    const edited =
      'Сообщение от Саши прочитано час назад в обед. Ответа так и нет.';
    expect(hasOwnDetail(edited, frame)).toBe(true);
  });

  it('без рамки (пусто) — длинная своя сцена всё равно считается деталью', () => {
    expect(hasOwnDetail('Позвонил, поговорили, стало легче.', '')).toBe(true);
  });

  it('без рамки — короткая сцена деталью не считается', () => {
    expect(hasOwnDetail('коротко', '')).toBe(false);
  });

  it('стёртая рамка и своя сцена короче — вклад засчитан', () => {
    // Реальный сценарий: человек стирает рамку целиком и пишет своё, короче
    // рамки. Счёт по разнице длин уходил в минус и блокировал кнопку
    // «Дальше» тому, кто как раз написал сцену полностью сам.
    expect(hasOwnDetail('Мама позвонила, и я замолчала', CASE_FRAMES[1])).toBe(
      true,
    );
  });

  it('сцена без рамки засчитывается по собственной длине', () => {
    expect(hasOwnDetail('Написал начальник в 23:40', '')).toBe(true);
    expect(hasOwnDetail('Устал', '')).toBe(false);
  });

  it('дописанное в начало видно так же, как дописанное в конец', () => {
    expect(
      hasOwnDetail(`Вечер четверга. ${CASE_FRAMES[0]}`, CASE_FRAMES[0]),
    ).toBe(true);
  });

  it('замена одного слова внутри рамки за свою деталь не считается', () => {
    const edited = CASE_FRAMES[0].replace('час', 'два часа');
    expect(hasOwnDetail(edited, CASE_FRAMES[0])).toBe(false);
  });
});
