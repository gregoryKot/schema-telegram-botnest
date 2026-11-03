import { describe, it, expect } from 'vitest';
import { joinConfirmFailText } from './joinConfirmFailText';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;
const conflict = { status: 409, reason: 'already_connected' };

describe('joinConfirmFailText', () => {
  it('терапевт, 409 already_connected: свой текст про действующее подключение', () => {
    expect(joinConfirmFailText(conflict, false, trFor('ty'))).toMatch(
      /уже есть подключение/,
    );
    expect(joinConfirmFailText(conflict, false, trFor('vy'))).toMatch(/У вас/);
  });

  it('терапевт, любая другая ошибка: общий отказ', () => {
    expect(joinConfirmFailText(new Error('x'), false, trFor('ty'))).toMatch(
      /Не получилось присоединиться\. Проверь/,
    );
  });

  // QA 2026-11, З1: обрыв связи — не повод «проверять ссылку».
  it('нет сети или 500 — честная причина и для терапевта, и для пары', () => {
    const offline = new TypeError('Failed to fetch');
    expect(joinConfirmFailText(offline, false, trFor('ty'))).toMatch(
      /Нет связи/,
    );
    expect(joinConfirmFailText({ status: 500 }, true, trFor('ty'))).toMatch(
      /Сервер не ответил/,
    );
  });

  it('пара: даже 409 already_connected не меняет текст', () => {
    expect(joinConfirmFailText(conflict, true, trFor('vy'))).toMatch(
      /Проверьте ссылку/,
    );
  });
});
