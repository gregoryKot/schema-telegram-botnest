// @vitest-environment jsdom
// Локальные копии «моих» схем и режимов: записал — прочитал тот же список; битое значение — пусто.
import { describe, it, expect, beforeEach } from 'vitest';
import { cacheMySchemaIds, cacheMyModeIds, readMySchemaIds, readMyModeIds } from './myPatternsCache';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';

beforeEach(() => localStorage.clear());

describe('myPatternsCache', () => {
  it('схемы: записал — прочитал', () => {
    cacheMySchemaIds(['abandonment', 'mistrust']);
    expect(readMySchemaIds()).toEqual(['abandonment', 'mistrust']);
  });

  it('режимы: записал — прочитал', () => {
    cacheMyModeIds(['vulnerable_child']);
    expect(readMyModeIds()).toEqual(['vulnerable_child']);
  });

  it('битое значение — пустой список', () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, '{oops');
    localStorage.setItem(MY_MODE_IDS_KEY, '{oops');
    expect(readMySchemaIds()).toEqual([]);
    expect(readMyModeIds()).toEqual([]);
  });

  it('пусто — пустой список', () => {
    expect(readMySchemaIds()).toEqual([]);
    expect(readMyModeIds()).toEqual([]);
  });
});
