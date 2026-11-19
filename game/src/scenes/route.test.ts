import { describe, expect, it } from 'vitest';
import { sceneForHash } from './route';

describe('вход по хешу', () => {
  it('без хеша и с чужим хешем — «Неделя»', () => {
    expect(sceneForHash('')).toEqual({ key: 'Week' });
    expect(sceneForHash('#whatever')).toEqual({ key: 'Week' });
  });
  it('#week — новая игра', () => {
    expect(sceneForHash('#week')).toEqual({ key: 'Week' });
    expect(sceneForHash('#WEEK')).toEqual({ key: 'Week' });
  });
  it('сцены старой игры открываются как раньше', () => {
    expect(sceneForHash('#intro')).toEqual({ key: 'Intro' });
    expect(sceneForHash('#tutorial')).toEqual({ key: 'Tutorial' });
    expect(sceneForHash('#game')).toEqual({ key: 'Game', data: { chapter: 'chapter1' } });
    expect(sceneForHash('#chapter3')).toEqual({ key: 'Game', data: { chapter: 'chapter3' } });
  });
});
