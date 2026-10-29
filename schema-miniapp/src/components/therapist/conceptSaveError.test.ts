// Причина отказа сохранения концептуализации (находка #880): сеть, таймаут,
// 413, 5xx, русский текст сервера — как есть, английский служебный — фолбэк.
// Строки с обращением проверяются в обеих формах.
import { describe, it, expect } from 'vitest';
import { conceptSaveErrorText } from './conceptSaveError';
import { HttpStatusError } from '../../apiClient';
import { pickForm } from '../../utils/addressForm';

const ty = (a: string, b: string) => pickForm('ty', a, b);
const vy = (a: string, b: string) => pickForm('vy', a, b);

describe('conceptSaveErrorText', () => {
  it('обрыв сети (TypeError движка) и таймаут (AbortError) — «Нет связи», обе формы', () => {
    const net = new TypeError('Failed to fetch');
    expect(conceptSaveErrorText(net, ty)).toBe(
      'Нет связи. Проверь подключение и попробуй ещё раз.',
    );
    expect(conceptSaveErrorText(net, vy)).toBe(
      'Нет связи. Проверьте подключение и попробуйте ещё раз.',
    );
    const abort = new DOMException('timeout', 'AbortError');
    expect(conceptSaveErrorText(abort, ty)).toContain('Нет связи');
  });

  it('5xx — «Ошибка сервера», обе формы', () => {
    expect(conceptSaveErrorText(new HttpStatusError(500), ty)).toBe(
      'Ошибка сервера. Попробуй позже.',
    );
    expect(conceptSaveErrorText(new HttpStatusError(503), vy)).toBe(
      'Ошибка сервера. Попробуйте позже.',
    );
  });

  it('413 — текст слишком длинный, обе формы', () => {
    expect(conceptSaveErrorText(new HttpStatusError(413), ty)).toContain(
      'Сократи записи и попробуй',
    );
    expect(conceptSaveErrorText(new HttpStatusError(413), vy)).toContain(
      'Сократите записи и попробуйте',
    );
  });

  it('русский текст сервера проходит как есть, английский ValidationPipe — фолбэк', () => {
    expect(
      conceptSaveErrorText(new HttpStatusError(400, 'Слишком много схем'), ty),
    ).toBe('Слишком много схем');
    expect(
      conceptSaveErrorText(
        new HttpStatusError(400, 'schemaIds must be an array'),
        ty,
      ),
    ).toBe('Не удалось сохранить');
    expect(conceptSaveErrorText(new HttpStatusError(404), ty)).toBe(
      'Не удалось сохранить',
    );
  });

  it('не-Error и прочий TypeError (ошибка кода, не сети) — фолбэк', () => {
    expect(conceptSaveErrorText('boom', ty)).toBe('Не удалось сохранить');
    expect(conceptSaveErrorText(new TypeError('x is not a function'), ty)).toBe(
      'Не удалось сохранить',
    );
    expect(conceptSaveErrorText(new Error('validation failed'), ty)).toBe(
      'Не удалось сохранить',
    );
  });
});
