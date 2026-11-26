import { describe, it, expect } from 'vitest';
import {
  codeJoinErrorText,
  isAlreadyConnectedError,
  joinTherapyErrorText,
  joinTransportErrorText,
} from './joinErrorText';
import { pickForm } from '../utils/addressForm';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  pickForm(form, ty, vy);
const conflict = Object.assign(new Error('x'), {
  status: 409,
  reason: 'already_connected',
});

describe('joinTherapyErrorText', () => {
  it('409 already_connected — особый текст, форма «ты»', () => {
    expect(joinTherapyErrorText(conflict, trFor('ty'))).toMatch(
      /^У тебя уже есть подключение/,
    );
  });

  it('409 already_connected — форма «вы»', () => {
    const text = joinTherapyErrorText(conflict, trFor('vy'));
    expect(text).toMatch(/^У вас уже есть подключение/);
    expect(text).not.toMatch(/тебя|отключись/);
  });

  it.each([
    ['409 с другой причиной', { status: 409, reason: 'other' }],
    ['409 без reason', { status: 409 }],
    ['404 неверный код', { status: 404, reason: 'already_connected' }],
    ['обычная Error', new Error('API error: 500')],
    ['null', null],
    ['строка', 'already_connected'],
  ])('%s — null (вызывающий оставляет дефолт)', (_n, err) => {
    expect(joinTherapyErrorText(err, trFor('ty'))).toBeNull();
    expect(isAlreadyConnectedError(err)).toBe(false);
  });
});

// QA 2026-11, З1: «Код не подошёл» — только когда сервер отказал по коду.
describe('codeJoinErrorText', () => {
  const ty = trFor('ty');
  it.each([
    ['400', { status: 400 }, /^Код не подошёл\. Проверь/],
    ['404', { status: 404 }, /^Код не подошёл/],
    ['409', conflict, /^У тебя уже есть подключение/],
    ['нет сети', new TypeError('Load failed'), /^Нет связи с сервером/],
    ['429', { status: 429 }, /^Слишком много попыток/],
    ['503', { status: 503 }, /^Сервер не ответил/],
    [
      'ошибка кода, не сеть',
      new TypeError('x is not a function'),
      /^Не получилось подключиться/,
    ],
  ])('%s', (_n, err, text) => {
    expect(codeJoinErrorText(err, ty)).toMatch(text);
  });

  it('форма «вы»', () => {
    expect(codeJoinErrorText({ status: 400 }, trFor('vy'))).toMatch(
      /Проверьте/,
    );
    expect(
      codeJoinErrorText(new TypeError('Failed to fetch'), trFor('vy')),
    ).toMatch(/Попробуйте/);
  });

  it('ответ по существу (4xx) — не сбой связи', () => {
    expect(joinTransportErrorText({ status: 400 }, ty)).toBeNull();
    expect(joinTransportErrorText(conflict, ty)).toBeNull();
  });
});
