import { describe, it, expect } from 'vitest';
import { joinTherapyErrorText, isAlreadyConnectedError } from './joinErrorText';
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
