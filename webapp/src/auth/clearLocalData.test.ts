// @vitest-environment jsdom
// Выход на общем устройстве обязан стирать клинический контент из браузера.
// Тест держит две вещи разом: что стирается всё лишнее и что переживают выход
// ровно два безобидных ключа (тема и решение по куки-баннеру).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearLocalData } from './clearLocalData';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('clearLocalData', () => {
  it('стирает клинический контент из localStorage и sessionStorage', () => {
    localStorage.setItem('letters_draft', 'письмо маме');
    localStorage.setItem('ysq_answers', '[1,2,3]');
    sessionStorage.setItem('auth_return_to', '/app/');

    clearLocalData();

    expect(localStorage.getItem('letters_draft')).toBeNull();
    expect(localStorage.getItem('ysq_answers')).toBeNull();
    expect(sessionStorage.getItem('auth_return_to')).toBeNull();
  });

  it('тему и решение по кукам оставляет — они не про человека, а про браузер', () => {
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('safe_place', 'дача');

    clearLocalData();

    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('safe_place')).toBeNull();
  });

  it('ключа-исключения не было — он и не появляется пустым', () => {
    localStorage.setItem('safe_place', 'дача');
    clearLocalData();
    expect(localStorage.key(0)).toBeNull();
  });

  it('хранилище недоступно (приватный режим) — выход не падает', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'clear')
      .mockImplementation(() => {
        throw new DOMException('denied');
      });

    expect(() => clearLocalData()).not.toThrow();
    spy.mockRestore();
  });
});
