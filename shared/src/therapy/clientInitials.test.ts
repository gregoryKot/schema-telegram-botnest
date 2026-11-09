import { describe, it, expect } from 'vitest';
import {
  clientAvatarInitials,
  clientDisplayName,
  clientInitials,
} from './clientInitials';

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

  it('пустое имя → «?»', () => {
    expect(clientInitials('')).toBe('?');
    expect(clientInitials('   ')).toBe('?');
  });

  // Аудит 2026-11: «Ира (пятница)» в сайдбаре и на «Сегодня» терапевта — «И(».
  it('скобки и тире — не буква: берётся первая буква слова, слово без неё пропускается', () => {
    expect(clientInitials('Ира (пятница)')).toBe('ИП');
    expect(clientInitials('Сергей П. (офлайн)')).toBe('СП');
    expect(clientInitials('Анна — Крылова')).toBe('АК');
    expect(clientInitials('«Лена» 2')).toBe('Л2');
    expect(clientInitials('( )')).toBe('?');
  });
});

// docs/open/therapy.md: клиент без имени звался «#123» на «Сегодня» и в
// сайдбаре и «ID 123» в списке, палитре ⌘K и шапке карточки.
describe('clientDisplayName — одна подпись клиента на весь кабинет', () => {
  const c = (o: {
    clientAlias?: string | null;
    name?: string | null;
    telegramId?: number | string;
  }) => ({
    clientAlias: null,
    name: null,
    telegramId: 123,
    ...o,
  });

  it('псевдоним терапевта важнее имени из аккаунта', () => {
    expect(clientDisplayName(c({ clientAlias: 'А.К.', name: 'Аня' }))).toBe(
      'А.К.',
    );
    expect(clientDisplayName(c({ name: 'Аня' }))).toBe('Аня');
  });

  it('без имени — «Без имени · номер», а не «#123» или «ID 123»', () => {
    expect(clientDisplayName(c({}))).toBe('Без имени · 123');
    expect(
      clientDisplayName(c({ name: undefined, clientAlias: undefined })),
    ).toBe('Без имени · 123');
  });

  it('пустой или из пробелов псевдоним не прячет имя', () => {
    expect(clientDisplayName(c({ clientAlias: '  ', name: 'Аня' }))).toBe(
      'Аня',
    );
    expect(clientDisplayName(c({ clientAlias: '', name: '' }))).toBe(
      'Без имени · 123',
    );
  });

  it('у офлайн-клиента id с минусом — номер без минуса, как в доске заданий', () => {
    expect(clientDisplayName(c({ telegramId: '-7' }))).toBe('Без имени · 7');
  });

  it('аватар без имени — «?», а не буквы подписи «Без имени»', () => {
    expect(clientAvatarInitials(c({}))).toBe('?');
    expect(
      clientAvatarInitials(c({ clientAlias: 'Анна Крылова', name: 'Аня' })),
    ).toBe('АК');
  });
});
