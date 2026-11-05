// @vitest-environment jsdom
// Единственный писатель кэша «моих» схем и режимов (зеркало User.mySchemaIds /
// myModeIds): записал — в localStorage лежит JSON-список, который читают экраны.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheMySchemaIds,
  cacheMyModeIds,
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
