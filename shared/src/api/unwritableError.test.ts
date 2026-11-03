import { describe, it, expect } from 'vitest';
import {
  UNWRITABLE_REASON,
  UNWRITABLE_SELECTION_NOTE,
  isUnwritableError,
  unwritableSelectionText,
} from './unwritableError';
import { pickForm } from '../utils/addressForm';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  pickForm(form, ty, vy);

describe('isUnwritableError', () => {
  it('409 unreadable_data — отказ записи поверх нечитаемого', () => {
    const err = Object.assign(new Error('x'), {
      status: 409,
      reason: UNWRITABLE_REASON,
    });
    expect(UNWRITABLE_REASON).toBe('unreadable_data');
    expect(isUnwritableError(err)).toBe(true);
  });

  it.each([
    ['409 с другой причиной', { status: 409, reason: 'already_connected' }],
    ['409 без reason', { status: 409 }],
    ['500 с тем же reason', { status: 500, reason: 'unreadable_data' }],
    ['обрыв сети', new TypeError('Failed to fetch')],
    ['null', null],
    ['строка', 'unreadable_data'],
  ])('%s — не он', (_name, err) => {
    expect(isUnwritableError(err)).toBe(false);
  });
});

describe('unwritableSelectionText', () => {
  it('форма «ты»', () => {
    const text = unwritableSelectionText(trFor('ty'));
    expect(text).toMatch(/^Выбор не сохранился на сервере/);
    expect(text).toMatch(/попробуй ещё раз позже$/);
  });

  it('форма «вы» — без «ты»-глаголов', () => {
    const text = unwritableSelectionText(trFor('vy'));
    expect(text).toMatch(/попробуйте ещё раз позже$/);
    expect(text).not.toMatch(/попробуй /);
  });

  it('UNWRITABLE_SELECTION_NOTE — те же две формы для SaveErrorNote', () => {
    expect(UNWRITABLE_SELECTION_NOTE.ty).toBe(
      unwritableSelectionText(trFor('ty')),
    );
    expect(UNWRITABLE_SELECTION_NOTE.vy).toBe(
      unwritableSelectionText(trFor('vy')),
    );
    expect(UNWRITABLE_SELECTION_NOTE.ty).not.toBe(UNWRITABLE_SELECTION_NOTE.vy);
  });
});
