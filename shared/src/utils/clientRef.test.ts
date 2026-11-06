// Адрес карточки клиента кабинета (clientRef.ts): постоянный код вместо id,
// который у офлайн-клиента менялся при подключении карточки к аккаунту.
import { describe, it, expect } from 'vitest';
import {
  CLIENT_CODE_RE,
  clientRef,
  parseClientRef,
  matchesClientRef,
  findClientByRef,
  clientPath,
  isClientCardOpen,
  canonicalClientPath,
} from './clientRef';

const offline = { telegramId: -16, urlCode: 'abcdefgh' };
const web = { telegramId: '1000000000000000123', urlCode: 'qrspnmkj' };
const legacy = { telegramId: 42 }; // старый сервер / старый кэш: кода нет
const clients = [offline, web, legacy];

describe('CLIENT_CODE_RE', () => {
  it('8 букв из алфавита без i, l, o и без цифр', () => {
    expect(CLIENT_CODE_RE.test('abcdefgh')).toBe(true);
    expect(CLIENT_CODE_RE.test('qrspnmkj')).toBe(true);
  });
  it('цифры, похожие буквы, регистр и длина — мимо', () => {
    for (const s of [
      'abcdefg1',
      'abcdefgi',
      'abcdefgl',
      'abcdefgo',
      'ABCDEFGH',
      'abcdefg',
      'abcdefghj',
      'abcdefgt',
      '-16',
    ]) {
      expect(CLIENT_CODE_RE.test(s)).toBe(false);
    }
  });
});

describe('clientRef', () => {
  it('есть код — в адресе код', () => {
    expect(clientRef(offline)).toBe('abcdefgh');
  });
  it('кода нет или он битый — id строкой (веб-id без округления)', () => {
    expect(clientRef(legacy)).toBe('42');
    expect(clientRef({ telegramId: 7, urlCode: null })).toBe('7');
    expect(clientRef({ telegramId: 7, urlCode: 'ABC12345' })).toBe('7');
    expect(clientRef({ telegramId: '1000000000000000123' })).toBe(
      '1000000000000000123',
    );
  });
});

describe('parseClientRef', () => {
  it('код — код, числовой id (старые ссылки) — id', () => {
    expect(parseClientRef('abcdefgh')).toBe('abcdefgh');
    expect(parseClientRef('-16')).toBe('-16');
    expect(parseClientRef('1000000000000000123')).toBe('1000000000000000123');
  });
  it('мусор и пустое — null', () => {
    for (const s of ['abc', 'abcdefgi', '12abc', '', undefined, null])
      expect(parseClientRef(s)).toBeNull();
  });
});

describe('matchesClientRef и findClientByRef', () => {
  it('код находит своего клиента, в том числе офлайн', () => {
    expect(matchesClientRef(offline, 'abcdefgh')).toBe(true);
    expect(findClientByRef(clients, 'abcdefgh')).toBe(offline);
    expect(findClientByRef(clients, 'qrspnmkj')).toBe(web);
  });
  it('старый числовой адрес находит клиента по id (строкой)', () => {
    expect(matchesClientRef(offline, '-16')).toBe(true);
    expect(findClientByRef(clients, '42')).toBe(legacy);
    expect(findClientByRef(clients, '1000000000000000123')).toBe(web);
  });
  it('чужой код, чужой id, мусор и пустое — не находит', () => {
    expect(matchesClientRef(offline, 'bbbbbbbb')).toBe(false);
    expect(matchesClientRef(offline, '16')).toBe(false);
    expect(matchesClientRef(legacy, 'abcdefgh')).toBe(false);
    expect(matchesClientRef(offline, null)).toBe(false);
    expect(findClientByRef(clients, 'bbbbbbbb')).toBeUndefined();
    expect(findClientByRef(clients, '999')).toBeUndefined();
    expect(findClientByRef(clients, '1000000000000000124')).toBeUndefined();
    expect(findClientByRef(clients, 'junk')).toBeUndefined();
    expect(findClientByRef(clients, null)).toBeUndefined();
  });
  it('битый urlCode, совпавший с числовым ref, не путается с id', () => {
    expect(
      findClientByRef([{ telegramId: 5, urlCode: '42' }], '42'),
    ).toBeUndefined();
  });
});

describe('clientPath', () => {
  it('клиент в списке с кодом — адрес с кодом', () => {
    expect(clientPath(-16, clients)).toBe('/cabinet/abcdefgh');
    expect(clientPath('-16', clients)).toBe('/cabinet/abcdefgh');
  });
  it('в списке без кода или нет в списке — адрес с id', () => {
    expect(clientPath(42, clients)).toBe('/cabinet/42');
    expect(clientPath(-16, [])).toBe('/cabinet/-16');
  });
});

describe('isClientCardOpen', () => {
  it('адрес с кодом этого клиента или его старый числовой адрес — открыта', () => {
    expect(isClientCardOpen('/cabinet/abcdefgh', -16, clients)).toBe(true);
    expect(isClientCardOpen('/cabinet/-16', -16, clients)).toBe(true);
    expect(isClientCardOpen('/cabinet/-16', '-16', [])).toBe(true);
  });
  it('код, которого список ещё не знает, — открыта (список кабинета догружается)', () => {
    expect(isClientCardOpen('/cabinet/abcdefgh', -16, [])).toBe(true);
  });
  it('на вкладке карточки (/cabinet/<ref>/<вкладка>) — тоже открыта', () => {
    expect(isClientCardOpen('/cabinet/abcdefgh/tasks', -16, clients)).toBe(
      true,
    );
    expect(isClientCardOpen('/cabinet/-16/tasks', -16, clients)).toBe(true);
    expect(isClientCardOpen('/cabinet/qrspnmkj/tasks', -16, clients)).toBe(
      false,
    );
  });
  it('карточка другого клиента, список, «Сегодня», мусор — не открыта', () => {
    expect(isClientCardOpen('/cabinet/qrspnmkj', -16, clients)).toBe(false);
    expect(isClientCardOpen('/cabinet/42', -16, clients)).toBe(false);
    expect(isClientCardOpen('/cabinet', -16, clients)).toBe(false);
    expect(isClientCardOpen('/cabinet/today', -16, [])).toBe(false);
    expect(isClientCardOpen('/cabinet/tasks', -16, [])).toBe(false);
    expect(isClientCardOpen('/cabinet/junk', -16, [])).toBe(false);
  });
});

describe('canonicalClientPath', () => {
  it('старый числовой адрес клиента с кодом → адрес с кодом', () => {
    expect(canonicalClientPath('/cabinet/-16', clients)).toBe(
      '/cabinet/abcdefgh',
    );
    expect(canonicalClientPath('/cabinet/1000000000000000123', clients)).toBe(
      '/cabinet/qrspnmkj',
    );
  });
  it('вкладка в старом адресе сохраняется', () => {
    expect(canonicalClientPath('/cabinet/-16/tasks', clients)).toBe(
      '/cabinet/abcdefgh/tasks',
    );
    expect(canonicalClientPath('/cabinet/abcdefgh/tasks', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet/-16/tasks/x', clients)).toBeNull();
  });
  it('уже код, не карточка, клиента нет, кода нет — менять нечего', () => {
    expect(canonicalClientPath('/cabinet/abcdefgh', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet/today', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet/tasks', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet', clients)).toBeNull();
    expect(canonicalClientPath('/today', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet/999', clients)).toBeNull();
    expect(canonicalClientPath('/cabinet/-16', [])).toBeNull();
    expect(canonicalClientPath('/cabinet/42', clients)).toBeNull();
  });
});
