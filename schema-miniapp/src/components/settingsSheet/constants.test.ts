// Чистая логика тихих часов уведомлений: форматирование окна и попадание
// часа в окно, которое может переходить через полночь (21:00–08:00) —
// именно на переходе через полночь легко перепутать >= / <.
import { describe, it, expect } from 'vitest';
import { pad, quietLabel, hourInQuiet } from './constants';

describe('pad', () => {
  it('дополняет однозначное число нулём', () => {
    expect(pad(8)).toBe('08');
  });

  it('двузначное число не меняет', () => {
    expect(pad(21)).toBe('21');
  });
});

describe('quietLabel', () => {
  it('start===end — «Выключены»', () => {
    expect(quietLabel(0, 0)).toBe('Выключены');
  });

  it('undefined — «Выключены»', () => {
    expect(quietLabel(undefined, undefined)).toBe('Выключены');
  });

  it('форматирует окно как HH:00 – HH:00', () => {
    expect(quietLabel(21, 8)).toBe('21:00 – 08:00');
  });
});

describe('hourInQuiet — окно НЕ через полночь (start < end)', () => {
  it('час внутри окна', () => {
    expect(hourInQuiet(10, 8, 12)).toBe(true);
  });

  it('час на границе конца — уже не в окне (полуоткрытый интервал)', () => {
    expect(hourInQuiet(12, 8, 12)).toBe(false);
  });

  it('час до начала окна — не в окне', () => {
    expect(hourInQuiet(7, 8, 12)).toBe(false);
  });
});

describe('hourInQuiet — окно через полночь (start > end)', () => {
  it('поздний вечер — в окне тишины', () => {
    expect(hourInQuiet(22, 21, 8)).toBe(true);
  });

  it('раннее утро до конца окна — в окне тишины', () => {
    expect(hourInQuiet(5, 21, 8)).toBe(true);
  });

  it('час на границе конца — уже не в окне', () => {
    expect(hourInQuiet(8, 21, 8)).toBe(false);
  });

  it('день — не в окне', () => {
    expect(hourInQuiet(14, 21, 8)).toBe(false);
  });
});

describe('hourInQuiet — тихие часы выключены', () => {
  it('start===end — никогда не в окне', () => {
    expect(hourInQuiet(3, 0, 0)).toBe(false);
  });

  it('undefined — никогда не в окне', () => {
    expect(hourInQuiet(3, undefined, undefined)).toBe(false);
  });
});
