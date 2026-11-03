import { describe, it, expect } from 'vitest';
import { clientInitials } from './clientInitials';

describe('clientInitials', () => {
  // QA 2026-11: сайдбар показывал первые две буквы имени — «АН» вместо «АК».
  it('первые буквы двух первых слов, а не две буквы первого слова', () => {
    expect(clientInitials('Анна Крылова')).toBe('АК');
    expect(clientInitials('Анна Мария Крылова')).toBe('АМ');
  });

  it('заглавные из строчных; одно слово — одна буква', () => {
    expect(clientInitials('анна к.')).toBe('АК');
    expect(clientInitials('иван')).toBe('И');
  });

  it('лишние пробелы между словами и по краям не дают пустых букв', () => {
    expect(clientInitials('  Анна   Крылова  ')).toBe('АК');
  });

  it('символ вне BMP — целиком, а не половиной суррогатной пары', () => {
    expect(clientInitials('😀 Анна')).toBe('😀А');
  });

  it('имя-заглушка «#123» → «#»; пустое → «?»', () => {
    expect(clientInitials('#555')).toBe('#');
    expect(clientInitials('')).toBe('?');
    expect(clientInitials('   ')).toBe('?');
  });
});
