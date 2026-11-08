// @vitest-environment jsdom
// Единственный писатель кэша «моих» схем и режимов (зеркало User.mySchemaIds /
// myModeIds): записал — в localStorage лежит JSON-список, который читают экраны.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheMySchemaIds,
  cacheMyModeIds,
  cacheMyPatternsFromProfile,
  trustedProfileLists,
  MY_SCHEMA_IDS_KEY,
  MY_MODE_IDS_KEY,
  shouldShowChildhoodWheel,
  CHILDHOOD_DONE_KEY,
} from './storageKeys';

beforeEach(() => localStorage.clear());

describe('storageKeys: писатели кэша', () => {
  it('cacheMySchemaIds: записал — прочитал тот же список', () => {
    cacheMySchemaIds(['abandonment', 'mistrust']);
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]')).toEqual(
      ['abandonment', 'mistrust'],
    );
  });
  it('cacheMyModeIds: пустой список тоже записывается, а не пропускается', () => {
    cacheMyModeIds(['critic']);
    cacheMyModeIds([]);
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBe('[]');
  });
  it('shouldShowChildhoodWheel: true, пока флага нет', () => {
    expect(shouldShowChildhoodWheel()).toBe(true);
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    expect(shouldShowChildhoodWheel()).toBe(false);
  });
});

describe('cacheMyPatternsFromProfile — профиль как источник правды', () => {
  it('пустые списки стирают старую копию', () => {
    cacheMySchemaIds(['abandonment']);
    cacheMyModeIds(['critic']);
    cacheMyPatternsFromProfile({ mySchemaIds: [], myModeIds: [] });
    expect(localStorage.getItem(MY_SCHEMA_IDS_KEY)).toBe('[]');
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBe('[]');
  });
  it('поля нет или оно не список строк — копия остаётся', () => {
    cacheMySchemaIds(['abandonment']);
    cacheMyPatternsFromProfile({});
    cacheMyPatternsFromProfile({ mySchemaIds: 'abandonment', myModeIds: [1] });
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '')).toEqual([
      'abandonment',
    ]);
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBeNull();
  });
  // Нечитаемый на сервере список приходит `[]` с именем в unreadableLists:
  // стереть им локальную копию — потерять единственный живой выбор (запись
  // поверх сервер отбивает 409, docs/open/frontend-ux.md).
  it('список из unreadableLists копию не стирает; читаемый соседний — пишется', () => {
    cacheMySchemaIds(['abandonment']);
    cacheMyModeIds(['critic']);
    cacheMyPatternsFromProfile({
      mySchemaIds: [],
      myModeIds: [],
      unreadableLists: ['mySchemaIds'],
    });
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '')).toEqual([
      'abandonment',
    ]);
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBe('[]');
  });
});

describe('trustedProfileLists', () => {
  it('отдаёт только читаемые списки строк', () => {
    expect(
      trustedProfileLists({
        mySchemaIds: ['a'],
        myModeIds: [],
        unreadableLists: ['myModeIds'],
      }),
    ).toEqual({ mySchemaIds: ['a'], myModeIds: undefined });
  });
  it('старый сервер без unreadableLists — оба списка как есть', () => {
    expect(trustedProfileLists({ mySchemaIds: [], myModeIds: ['m'] })).toEqual({
      mySchemaIds: [],
      myModeIds: ['m'],
    });
  });
});
